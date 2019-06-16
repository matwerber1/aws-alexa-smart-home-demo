/* eslint-disable no-console */
const AWS = require("aws-sdk");

const GET_DEVICES_BY_USER_FUNCTION = process.env.GET_DEVICES_BY_USER_FUNCTION;
const VERIFY_COGNITO_TOKEN_FUNCTION = process.env.VERIFY_COGNITO_TOKEN_FUNCTION;
const IOT_ENDPOINT = process.env.IOT_ENDPOINT;

const AlexaResponse = require("./AlexaResponse");
const discoveryConfig = require ("./discoveryConfig");
const iot = new AWS.Iot();
const iotdata = new AWS.IotData({ endpoint: IOT_ENDPOINT });
const dynamodb = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda();
const REQUIRED_PAYLOAD_VERSION = "3";
const DEVICE_TABLE_NAME = process.env.DEVICE_TABLE;

// For debugging / test purposes if you do not have a physical device linked to
// your Thing in the IoT Core Registry, set the value below to true; this will
// copy your desired state changes to the reported state changes. Normally, 
// only the physical device would update reported state. If using a physical device,
// set the value below to false:
const copyDesiredStateToReportedStateInShadow = true;

exports.handler = async function (request, context) {

    try {
        log("Alexa request:\n", request);
        log("Alexa context:\n", context);

        verifyRequestContainsDirective(request);
        
        var directive = request.directive;
        var header = directive.header;
        var namespace = header.namespace; 
        var name = header.name;
        var ignoreExpiredToken = request.ignoreExpiredToken || false;   // True for debugging purposes, if we're using an old token

        verifyPayloadVersionIsSupported(header.payloadVersion);
        
        var userId = await verifyAuthTokenAndGetUserId(
            namespace,
            directive,
            ignoreExpiredToken
        );

        // Is this a request to discover available devices?
        if (namespace === 'Alexa.Discovery') {
            var response = await handleDiscovery(request, context, userId);
            return sendResponse(response.get());
        }
        // If this is not a discovery request, it is a directive to do something
        // to or retrieve info about a specific endpoint. We must verify that
        // the endpoint exists * and * is mapped to our current user before 
        // we do anything with it: 
        else {
           
            var endpoint = await verifyEndpointAndGetEndpointDetail(userId, directive.endpoint.endpointId);
    
            verifyEndpointConnectivity(endpoint);

            if (namespace === 'Alexa.ThermostatController') {
                let response = await handleThermostatControl(request, context, endpoint);
                return sendResponse(response.get());
            }
            else if (namespace === 'Alexa' && name === 'ReportState') {
                let response = await handleReportState(request, context, endpoint);
                return sendResponse(response.get());
            }
            else {       
                throw new AlexaException(
                    'INVALID_DIRECTIVE', 
                    `Namespace ${namespace} with name ${name} is unsupported by this skill.`
                );
            }
        }
    }
    catch (err) {
        log(`Error: ${err.name}: ${err.message}`);
        log('Stack:\n' + err.stack);
        var errorType, errorMessage, additionalPayload;

        // if AlexaError key is present (regardless of value), then we threw
        // an error intentionally and we want to bubble up a specific Alexa
        // error type. If the key is not present, it is an unhandled error and
        // we respond with a generic Alexa INTERNAL_ERROR message.
        if (err.hasOwnProperty('AlexaError')) {
            errorType = err.name;
            errorMessage = err.message;
            additionalPayload = checkValue(err.additionalPayload, undefined);
        } else {
            errorType = 'INTERNAL_ERROR';
            errorMessage = `Unhandled error: ${err}`
        }
        return sendErrorResponse(errorType, errorMessage, additionalPayload);
    }

};

function verifyEndpointConnectivity(endpoint) {

    log('Verifying endpoint is online...');
    var shadow = endpoint.shadow;

    if (shadow.hasOwnProperty('state') === false) {
        throw new AlexaException('ENDPOINT_UNREACHABLE', 'Shadow does not contain a state object');
    }

    if (shadow.state.hasOwnProperty('reported') === false) {
        throw new AlexaException('ENDPOINT_UNREACHABLE', 'Shadow does not contain a state.reported object');
    }
    
    if (shadow.state.reported.hasOwnProperty('connectivity') === false) {
        throw new AlexaException('ENDPOINT_UNREACHABLE', 'Shadow does not contain a state.reported.connectivity object');
    }
    
    if (shadow.state.reported.connectivity !== "OK") {
        throw new AlexaException('ENDPOINT_UNREACHABLE', `Device unavailable, reported online=${shadow.state.reported.online}`);
    }

    log('Endpoint is online.');

}

function verifyRequestContainsDirective(request) {
    // Basic error checking to confirm request matches expected format.
    if (!('directive' in request)) {
        throw new AlexaException(
            'INVALID_DIRECTIVE',
            'directive is missing from request'
        );
    }
}

function verifyPayloadVersionIsSupported(payloadVersion) {
    // Basic error checking to confirm request matches expected format.
    if (payloadVersion !== REQUIRED_PAYLOAD_VERSION) {
        throw new AlexaException(
            'INVALID_DIRECTIVE', 
            `Payload version ${payloadVersion} unsupported.`
            + `Expected v${REQUIRED_PAYLOAD_VERSION}`
        );
    }
}

async function verifyEndpointAndGetEndpointDetail(userId, endpointId) {
    /*
    If a directive (other than discovery) is received for a specific endpoint, 
    there are two ways the endpoint may be invalid: Alexa Cloud may think it is
    mapped to our specific user but it has since been reassigned to another user, 
    or, the mapping is correct but, for whatever reason, the "Thing" in AWS IoT
    no longer exists. In the former, an example scenario is that the device was
    given to a friend and that friend registered it to their account. The Alexa
    Cloud does not know this happened... we do not want the original owner to be
    able to control the device at this point, so we should be sure to verify the
    device is associated to the user invoking the skill. In the latter example, 
    it wouldn't be typical to delete an IoT Thing for a given device but its not
    impossible (maybe by mistake, or maybe because a device was suspected as being
    compromised and we want to remove it from service?).
    */
    
    // First, let's see if device is mapped to our user in DynamoDB:
    log('Verifying that endpoint is mapped to the user invoking the skill...')
    var params = {
        Key: {
            hashId: 'userId_' + userId,        
            sortId: 'thingName_' + endpointId
        }, 
        TableName: DEVICE_TABLE_NAME
    };
    log('Calling dynamodb.getItem() with params:', params);
    var getResponse = await dynamodb.get(params).promise();
    if (getResponse.hasOwnProperty('Item')) {
        // The Item key will only be present if the item exists.
        log("Endpoint is mapped to invoking user.");
    }
    else {
        throw new AlexaException(
            'NO_SUCH_ENDPOINT',
            'Endpoint ID exists in AWS IoT Registry but is not mapped to this user in DynamoDB'
        );
    }

    // Now, let's see if the device actually exists in the Iot Core registry.
    // If it does exist, we will populate our response with the IoT thing details
    // and current reported shadow state. 
    var endpoint = {};    
    try {
        // The IoT describeThing() API will throw an error if the given thing
        // name does not exist, so we must wrap in a try/catch block.
        console.log('Verifying existence of endpoint in AWS IoT Registry...');
        let params = {
            thingName: endpointId
        };
        log('Calling iot.describeThing() with params:', params);
        endpoint = await iot.describeThing(params).promise();
        log("Endpoint exists in Iot Registry");
        endpoint.config = getDeviceConfigFromIotThingAttributes(endpoint.attributes);
        
        // Endpoint ID is core concept when dealing with the Alexa Smart Home API;
        // We happen to use the IoT Registry's thingName as our endpointID, but
        // its possible other implementations may use a different value for the
        // endpoint ID. So, rather than let all later code refer to "thingName",
        // I'd rather explicitly create an endpointId key. That way, it's easier
        // to drop in a different value if you prefer not to use the IoT thing name.
        endpoint.endpointId = endpoint.thingName;
        endpoint.shadow = await getDeviceShadow(endpoint.thingName);
        log('Full endpoint detail:', endpoint);
    }
    catch (err) {
        if (err.name === "ResourceNotFoundException") {
            throw new AlexaException(
                'NO_SUCH_ENDPOINT',
                'Endpoint ID does not exist as Thing Name in AWS IoT Registry'
            );
        }
        else {
            // If it's not a ResourceNotFound error, then it is an unexpected
            // error and we simply pass it upstream to our main error handler.
            throw(err); 
        }
    }
    return endpoint;
}

async function handleDiscovery(request, context, userId) {

    try {
        log("Calling handleDiscovery()");
    
        var alexaResponse = new AlexaResponse({
            "namespace": "Alexa.Discovery",
            "name": "Discover.Response"
        });

        var endpoints = await getUserEndpoints(userId);

        endpoints.forEach(endpoint => {
            alexaResponse.addPayloadEndpoint(endpoint);
        });

        return alexaResponse;
    }
    catch (err) {
        throw ("handleDiscovery() failed: " + err);
    }

}

async function verifyAuthTokenAndGetUserId(namespace, directive, ignoreExpiredToken) {
    /* This function calls another function to determine whether the auth token 
       provided by Alexa during invocation is valid and not expired.  
    */
    
    try {
        log('Validating auth token...');
        // The location of the user's auth token is in the payload of the 
        // request directive if the namespace is Discovery; otherwise, it is
        // in the request endpoint:
        var encodedAuthToken;
        if (namespace === 'Alexa.Discovery') {
            encodedAuthToken = directive.payload.scope.token;
        }
        else {
            encodedAuthToken = directive.endpoint.scope.token;
        }

        var params = {
            FunctionName: VERIFY_COGNITO_TOKEN_FUNCTION, 
            InvocationType: "RequestResponse", 
            Payload: JSON.stringify({ token: encodedAuthToken })
        };
    
        log('Calling lambda.invoke() with params:', params);
        var response = await lambda.invoke(params).promise();

        if (response.hasOwnProperty('FunctionError')) {
            var authError = JSON.parse(response.Payload);
            if (authError.errorMessage === 'Token is expired'
                 && ignoreExpiredToken === true) {
                throw new AlexaException(
                    'EXPIRED_AUTHORIZATION_CREDENTIAL',
                    'Auth token is expired'
                );
            }
            else {
                throw new AlexaException(
                    'INVALID_AUTHORIZATION_CREDENTIAL',
                    'Auth token is invalid'
                );
            }
        }
        console.log('Auth token is valid...');
        var plaintextAuthToken = JSON.parse(response.Payload);

        // Cognito has both a username and a sub; a sub is unique and never
        // reasigned; a username can be reasigned; it is therefore important
        // to use the 'sub' and not the username as the User ID:
        var userId = plaintextAuthToken.sub;
        return userId;
    }
    catch (err) {
        console.log(`Error invoking ${VERIFY_COGNITO_TOKEN_FUNCTION}: ${err}`);
        throw (err);
    }
}


async function getUserEndpoints(userId) {
    /*
    This function takes a user ID obtained from the validated and not-expired auth
    token provided by Alexa in the function request and invokes another function
    that returns a list of all devices associated to that user. 
    */
    log("Getting user endpoints...");
    var payload = JSON.stringify({
        userId: userId
    });

    var params = {
        FunctionName: GET_DEVICES_BY_USER_FUNCTION, 
        InvocationType: "RequestResponse", 
        Payload: payload
    };

    log("Invoking Lambda with params: ", params);
    var getUserDevicesResponse = await lambda.invoke(params).promise();

    log("User Device Lambda response: ", getUserDevicesResponse);
    var devices = (JSON.parse(getUserDevicesResponse.Payload)).deviceList;
    log("Devices: ", devices);
    /*
        response will contain: {
            thingName: "xxxx",
            userId: "yyyy"
        }
    */

    var endpoints = [];

    for (const device of devices) {
        let params = {
            thingName: device.thingName
        };

        log("Calling IoT.describeThing() with params: ", params);
        var iotDescription = await iot.describeThing(params).promise();
        var iotAttributes = iotDescription.attributes;
        log("IoT Description:\n", iotDescription);
        var thingConfig = getDeviceConfigFromIotThingAttributes(iotAttributes);

        var endpoint = {
            endpointId: device.thingName,
            manufacturerName: thingConfig.manufacturerName,
            friendlyName: thingConfig.friendlyName,
            description: thingConfig.description,
            displayCategories: thingConfig.displayCategories,
            capabilities: thingConfig.capabilities,
        };

        endpoints.push(endpoint);
    }
    log("User endpoints:\n", endpoints);
    return endpoints;
}

function getDeviceConfigFromIotThingAttributes(attributes) {
    return discoveryConfig[attributes.modelNumber][attributes.firmwareVersion];
}

function log(message1, message2) {
    if (message2 == null) {
        console.log(message1);
    } else {
        console.log(message1 + JSON.stringify(message2, null, 2));
    }
}

function validateSetpointIsInAllowedRange(setpoint, validRange) {

    // We convert to the minValue's scale; we don't bother to check whether the min and max are different
    // scales in the discoveryConfig.js file; it would be odd to have them different. 
    let minValue = validRange.minimumValue.value;
    let maxValue = validRange.maximumValue.value;
    let validScale = validRange.minimumValue.scale;
    let desiredValue = convertTemperature(setpoint.value, setpoint.scale, validScale);
    
    if (minValue <= desiredValue && desiredValue <= maxValue) {
        log(`Requested setpoint of ${desiredValue} within allowed range of ${minValue} to ${maxValue} ${validScale}.`);
        return;
    }
    else {
        var errorPayload = {
            validRange: validRange
        };
        throw new AlexaException(
            'TEMPERATURE_VALUE_OUT_OF_RANGE',
            `Requested setpoint of ${desiredValue} outside allowed range of ${minValue} to ${maxValue} ${validScale}.`,
            errorPayload
        );
    }

}

async function handleReportState(request, context, endpoint) {
    
    log('Gathering state from IoT Thing shadow to report back to Alexa...');

    var endpointId = endpoint.endpointId;
    var token = request.directive.endpoint.scope.token;
    var correlationToken = request.directive.header.correlationToken;
    var currentState = endpoint.shadow.state.reported;    
    
    // Basic response header
    var alexaResponse = new AlexaResponse(
        {
            "name": 'StateReport',
            "correlationToken": correlationToken,
            "token": token,
            "endpointId": endpointId
        }
    );

    // Gather current properties and add to our response
    alexaResponse.addContextProperty({
        namespace: "Alexa.EndpointHealth",
        name: "connectivity",
        value: {
            value: currentState.connectivity
        } 
    });

    alexaResponse.addContextProperty({
        namespace: "Alexa.ThermostatController",
        name: "targetSetpoint",
        value: {
            value: currentState.targetSetpoint.value,
            scale: currentState.targetSetpoint.scale
        }
    });

    alexaResponse.addContextProperty({
        namespace: "Alexa.ThermostatController",
        name: "thermostatMode",
        value: currentState.thermostatMode
    });

    alexaResponse.addContextProperty({
        namespace: "Alexa.TemperatureSensor",
        name: "temperature",
        value: currentState.temperature
    });

    return alexaResponse.get();
}

async function handleThermostatControl(request, context, endpoint) {
    /*  This function handles all requests that Alexa identifies as being a 
        "ThermostatController" directive, such as:
          - Turn device to cool mode
          - Turn device to heat mode
          - Increase device temperature
          - Decrease device temperature
          - Set temperature to X degrees
    */
    var endpointId = endpoint.endpointId;
    var thingName = endpoint.thingName;
    var token = request.directive.endpoint.scope.token;
    var correlationToken = request.directive.header.correlationToken;
    var requestMethod = request.directive.header.name; 
    var payload = request.directive.payload;

    var alexaResponse = new AlexaResponse(
        {
            "correlationToken": correlationToken,
            "token": token,
            "endpointId": endpointId
        }
    );
    
    log(`Running ThermostatControl handler for ${requestMethod} method`);

    if (requestMethod === 'SetTargetTemperature') {

        var targetSetpoint = payload.targetSetpoint;
        
        validateSetpointIsInAllowedRange(targetSetpoint, endpoint.config.validRange);

        let shadowState = {
            state: {
                desired: {
                    targetSetpoint: {
                        value: targetSetpoint.value,
                        scale: targetSetpoint.scale
                    }
                }
            }
        };

        // For debugging purposes, we may choose to copy the desired state to reported state:
        if (copyDesiredStateToReportedStateInShadow === true) {
            shadowState.state.reported = shadowState.state.desired;
        }

        await updateThingShadow(thingName, shadowState);

        var targetpointContextProperty = {
            namespace: "Alexa.ThermostatController",
            name: "targetSetpoint",
            value: {
                value: targetSetpoint.value,
                scale: targetSetpoint.scale
            }
        };
        alexaResponse.addContextProperty(targetpointContextProperty);
        return alexaResponse.get();

    }
    else if (requestMethod === 'AdjustTargetTemperature') {

        var currentSetpoint = endpoint.shadow.state.reported.targetSetpoint;
        var currentValue = currentSetpoint.value;
        var currentScale = currentSetpoint.scale;
        
        var targetSetpointDelta = payload.targetSetpointDelta;
        var deltaValue = targetSetpointDelta.value;
        var deltaScale = targetSetpointDelta.scale;

        log('Current setpoint:', currentSetpoint);
        log('Target delta:', targetSetpointDelta);

        // It's possible that the requested temperature change is in a different
        // scale from that being used/reported by the device. In such a case, 
        // the Alexa guide states we should report the new adjusted value in the
        // device's scale. When the scales are different, we must convert the
        // current temperature to the scale of the requested delta in order to
        // add (or subtract) the delta from the current temperature to arrive
        // at the new desired temperature. Then, we must convert this new value
        // back to the temp scale currently in use by the device. If the current
        // and delta scales are the same (e.g. both Fahrenheit or both Celsius),
        // then the convertTemperature() function simply returns the same value
        // it was provided, without modification. 
        // https://developer.amazon.com/docs/device-apis/alexa-thermostatcontroller.html#adjusttargettemperature-directive
        var currentValueInDeltaScale = convertTemperature(currentValue, currentScale, deltaScale);
        var newValueInDeltaScale = currentValueInDeltaScale + deltaValue;
        var newValueInCurrentScale = convertTemperature(newValueInDeltaScale, deltaScale, currentScale);

        var newTargetSetpoint = {
            value: newValueInCurrentScale,
            scale: currentScale
        };

        let shadowState = {
            state: {
                desired: {
                    targetSetpoint: newTargetSetpoint
                }
            }
        };

        // For debugging purposes, we may choose to copy the desired state to reported state:
        if (copyDesiredStateToReportedStateInShadow === true) {
            shadowState.state.reported = shadowState.state.desired;
        }

        await updateThingShadow(thingName, shadowState);

        alexaResponse.addContextProperty({
            namespace: "Alexa.ThermostatController",
            name: "targetSetpoint",
            value: newTargetSetpoint
        });

        return alexaResponse.get();

    }
    else if (requestMethod === 'SetThermostatMode') {
        
        var thermostatMode = payload.thermostatMode;

        let shadowState = {
            state: {
                desired: {
                    thermostatMode: thermostatMode.value
                }
            }
        };

        // For debugging purposes, we may choose to copy the desired state to reported state:
        if (copyDesiredStateToReportedStateInShadow === true) {
            shadowState.state.reported = shadowState.state.desired;
        }

        await updateThingShadow(thingName, shadowState);

        // Context properties are how we affirmatively tell Alexa that the state
        // of our device after we have successfully completed the requested changes.
        // The not required, it is recommended that *all* properties be reported back, 
        // regardless of whether they were changed. 
        // At the moment, we are only reporting back the changed property.
        alexaResponse.addContextProperty({
            namespace: "Alexa.ThermostatController",
            name: "thermostatMode",
            value: thermostatMode.value
        });

        return alexaResponse.get();
    }
    else {
        log(`ERROR: Unsupported request method ${requestMethod} for ThermostatController.`);
        throw new AlexaException(
            'INTERNAL_ERROR',
            'Unsupported request method ${requestMethod} for ThermostatController'
        );
    }    
}

function convertTemperature(temperature, currentScale, desiredScale) {
    if (currentScale === desiredScale) {
        return temperature;
    }
    else if (currentScale === 'FAHRENHEIT' && desiredScale === 'CELSIUS') {
        return convertFahrenheitToCelsius(temperature);
    }
    else if (currentScale === 'CELSIUS' && desiredScale === 'FAHRENHEIT') {
        return convertCelsiusToFahrenheit(temperature);
    }
    else {
        throw (`Unable to convert ${currentScale} to ${desiredScale}, unsupported temp scale.`);
    }
    
}

function convertCelsiusToFahrenheit(celsius) {
    var fahrenheit = Math.round((celsius * 1.8) + 32);
    log(`Converted temperature to ${fahrenheit} FAHRENHEIT.`);
    return fahrenheit;
}

function convertFahrenheitToCelsius(fahrenheit) {
    var celsius = Math.round((fahrenheit - 32) * 0.556);
    log(`Converted temperature to ${celsius} CELSIUS.`);
    return celsius;
}

async function getDeviceShadow(thingName) {
    // Get the device's reported state per the state.reported object of the
    // corresponding IoT thing's device shadow.
    var params = {
        thingName: thingName
    };
    log('Calling iotdata.getThingShadow() with params:', params);
    var response = await iotdata.getThingShadow(params).promise();
    var shadow = JSON.parse(response.payload);
    log('getThingShadow() response:', shadow);
    return shadow;
    
}

async function updateThingShadow(thingName, shadowState) {
    try {
        var params = {
            payload: JSON.stringify(shadowState) /* Strings will be Base-64 encoded on your behalf */, /* required */
            thingName: thingName /* required */
        };
        // Updating shadow updates our *control plane*, but it doesn't necessarily
        // mean our device state has changed. The device is responsible for monitoring
        // the device shadow and responding to changes in desired states. 
        log(`Calling iotdata.updateThingShadow() with params:`, params);
        var updateShadowResponse = await iotdata.updateThingShadow(params).promise();
        log(`Shadow update response:\n`, JSON.parse(updateShadowResponse.payload));    
    }
    catch (err) {
        console.log('Error: unable to update device shadow:', err);
        throw (err);
    }
}

function sendResponse(response) {
    log("Lambda response to Alexa Cloud:\n", response);
    return response
}

function sendErrorResponse(type, message, additionalPayload) {
    log("Preparing error response to Alexa Cloud...");
    var payload = {
        "type": type,
        "message": message
    };
    // Certain Alexa error response types allow or require additional parameters in the payload response
    if (additionalPayload !== undefined) {
        payload = { ...payload, ...additionalPayload }
    }
    var alexaErrorResponse = new AlexaResponse({
        "name": "ErrorResponse",
        "payload": payload
    });
    return sendResponse(alexaErrorResponse.get());
}

function AlexaException(name, message, additionalPayload) {
    log('Creating handled Alexa exception...');
    // The error name should be one of the Alexa.ErrorResponse interface types:
    // https://developer.amazon.com/docs/device-apis/alexa-errorresponse.html
    var error = new Error(); 
    this.stack = error.stack;
    this.name = name;
    this.message = message;
    this.AlexaError = true;
    this.additionalPayload = checkValue(additionalPayload, undefined);
}

function checkValue(value, defaultValue) {

    if (value === undefined || value === {} || value === "") {
        return defaultValue;
    }
    return value;
}