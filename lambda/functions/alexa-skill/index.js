const AWS = require("aws-sdk");

const GET_DEVICES_BY_USER_FUNCTION = process.env.GET_DEVICES_BY_USER_FUNCTION;
const VERIFY_COGNITO_TOKEN_FUNCTION = process.env.VERIFY_COGNITO_TOKEN_FUNCTION;
const IOT_ENDPOINT = process.env.IOT_ENDPOINT;

const AlexaResponse = require("./AlexaResponse");
const discoveryConfig = require ("./discoveryConfig");
const iotdata = new AWS.IotData({ endpoint: IOT_ENDPOINT });
const iot = new AWS.Iot();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda();
const REQUIRED_PAYLOAD_VERSION = "3";
const DEVICE_TABLE_NAME = process.env.DEVICE_TABLE;

exports.handler = async function (request, context) {

    try {
        log("Alexa request:\n", request);
        log("Alexa context:\n", context);

        verifyRequestContainsDirective(request);
        
        var directive = request.directive;
        var header = directive.header;
        var namespace = header.namespace; 
        var ignoreExpiredToken = request.ignoreExpiredToken || false;   // True for debugging purposes, if we're using an old token

        verifyPayloadVersionIsSupported(header.payloadVersion);
        
        var userId = await verifyAuthTokenAndGetUserId(
            namespace,
            directive,
            ignoreExpiredToken
        );

        // Is this a request to discover available devices?
        if (namespace === 'Alexa.Discovery') {
            let response = await handleDiscovery(request, context, userId);
            return sendResponse(response.get());
        }
        else {
            // If this is not a discovery request, it is a directive to do something
            // to or retrieve info about a specific endpoint. We must verify that
            // the endpoint exists * and * is mapped to our current user before 
            // we do anything with it: 
            await verifyEndpoint(userId, directive.endpoint.endpointId);
    
            if (namespace === 'Alexa.ThermostatController') {
                let response = await handleThermostatControl(request, context);
                return sendResponse(response.get());
            }
            else {       
                throw new AlexaException(
                    'INVALID_DIRECTIVE', 
                    `Namespace ${namespace} is unsupported by this skill.`
                );
            }
        }
    }
    catch (err) {
        log(`Error: ${err.name}: ${err.message}`);
        log('Stack:\n' + err.stack);
        let errorType, errorMessage;

        // if AlexaError key is present (regardless of value), then we threw
        // an error intentionally and we want to bubble up a specific Alexa
        // error type. If the key is not present, it is an unhandled error and
        // we respond with a generic Alexa INTERNAL_ERROR message.
        if (err.hasOwnProperty('AlexaError')) {
            errorType = err.name;
            errorMessage = err.message;
        } else {
            errorType = 'INTERNAL_ERROR';
            errorMessage = `Unhandled error: ${err}`
        }
        return sendErrorResponse(errorType, errorMessage);
    }

};

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

async function verifyEndpoint(userId, endpointId) {
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
    try {
        // The IoT describeThing() API will throw an error if the given thing
        // name does not exist, so we must wrap in a try/catch block.
        console.log('Verifying existence of endpoint in AWS IoT Registry...');
        let params = {
            thingName: endpointId
        };
        log('Calling iot.describeThing() with params:', params);
        let iotDescription = await iot.describeThing(params).promise();
        log("Endpoint exists in Iot Registry:\n" + JSON.stringify(iotDescription));
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
}

async function handleDiscovery(request, context, userId) {

    try {
        log("Calling handleDiscovery()");
    
        let alexaResponse = new AlexaResponse({
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
    
        let response = await lambda.invoke(params).promise();

        if (response.hasOwnProperty('FunctionError')) {
            let authError = JSON.parse(authResponse.Payload);
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
        plaintextAuthToken = JSON.parse(response.Payload);

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

    log("Invoking Lambda: ", params);
    let getUserDevicesResponse = await lambda.invoke(params).promise();

    log("User Device Lambda response: ", getUserDevicesResponse);
    var devices = (JSON.parse(getUserDevicesResponse.Payload)).deviceList;
    log("Devices: ", devices);
    /*
        response will contain: {
            thingName: "xxxx",
            userId: "yyyy"
        }
    */

    let endpoints = [];

    for (const device of devices) {
        let params = {
            thingName: device.thingName
        };

        log("Calling IoT.describeThing() with params: ", params);
        let iotDescription = await iot.describeThing(params).promise();
        log("IoT Description:\n", iotDescription);
        let thingConfig = discoveryConfig[iotDescription.attributes.modelNumber][iotDescription.attributes.firmwareVersion];

        let endpoint = {
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

function log(message1, message2) {
    if (message2 == null) {
        console.log(message1);
    } else {
        console.log(message1 + JSON.stringify(message2, null, 2));
    }
}

async function handleThermostatControl(request, context) {
    /*  This function handles all requests that Alexa identifies as being a 
        "ThermostatController" directive, such as:
          - Turn device to cool mode
          - Turn device to heat mode
          - Increase device temperature
          - Decrease device temperature
          - Set temperature to X degrees
    */
    let endpointId = request.directive.endpoint.endpointId;
    let token = request.directive.endpoint.scope.token;
    let correlationToken = request.directive.header.correlationToken;
    let requestMethod = request.directive.header.name; 

    let alexaResponse = new AlexaResponse(
        {
            "correlationToken": correlationToken,
            "token": token,
            "endpointId": endpointId
        }
    );
    
    log(`Running ThermostatControl handler for ${requestMethod} method`);

    if (requestMethod === 'SetTargetTemperature') {
        
        // TODO - update the device shadow's desired state

        let targetpointContextProperty = {
            namespace: "Alexa.ThermostatController",
            name: "targetSetpoint",
            value: {
                value: request.directive.payload.targetSetpoint.value,
                scale: request.directive.payload.targetSetpoint.scale
            }
        };

        alexaResponse.addContextProperty(targetpointContextProperty);
        return alexaResponse.get();

    }
    else if (requestMethod === 'SetThermostatMode') {
        
        var shadowState = {
            state: {
                desired: {
                    mode: request.directive.payload.thermostatMode.value
                }
            }
        }

        var params = {
            payload: JSON.stringify(shadowState) /* Strings will be Base-64 encoded on your behalf */, /* required */
            thingName: endpointId /* required */
        };

        // Updating shadow updates our *control plane*, but it doesn't necessarily
        // mean our device state has changed. The device is responsible for monitoring
        // the device shadow and responding to changes in desired states. 
        log(`Updating desired shadow state of IoT Thing ${endpointId}...:\n`, shadowState);
        var updateShadowResponse = await iotdata.updateThingShadow(params).promise();
        log(`Shadow update response:\n`, JSON.parse(updateShadowResponse.payload));
        
        // Context properties are how we affirmatively tell Alexa that the state
        // of our device after we have successfully completed the requested changes.
        // The not required, it is recommended that *all* properties be reported back, 
        // regardless of whether they were changed. 
        // At the moment, we are only reporting back the changed property.
        let targetpointContextProperty = {
            namespace: "Alexa.ThermostatController",
            name: "thermostatMode",
            value: request.directive.payload.thermostatMode.value
        };
        alexaResponse.addContextProperty(targetpointContextProperty);
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

function sendResponse(response) {
    log("Lambda response to Alexa Cloud:\n", response);
    return response
}

function sendErrorResponse(type, message) {
    log("Preparing error response to Alexa Cloud...");
    let alexaErrorResponse = new AlexaResponse({
        "name": "ErrorResponse",
        "payload": {
            "type": type,
            "message": message
        }
    });
    return sendResponse(alexaErrorResponse.get());
}

function AlexaException(name, message) {
    log('Creating handled Alexa exception...');
    // The error name should be one of the Alexa.ErrorResponse interface types:
    // https://developer.amazon.com/docs/device-apis/alexa-errorresponse.html
    var error = new Error(); 
    this.stack = error.stack;
    this.name = name;
    this.message = message;
    this.AlexaError = true;
}