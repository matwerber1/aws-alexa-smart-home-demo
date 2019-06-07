const AWS = require("aws-sdk");

const GET_DEVICES_BY_USER_FUNCTION = process.env.GET_DEVICES_BY_USER_FUNCTION;
const VERIFY_COGNITO_TOKEN_FUNCTION = process.env.VERIFY_COGNITO_TOKEN_FUNCTION;
const IOT_ENDPOINT = process.env.IOT_ENDPOINT;

const AlexaResponse = require("./AlexaResponse");
const discoveryConfig = require ("./discoveryConfig");
const iotdata = new AWS.IotData({ endpoint: IOT_ENDPOINT });
const iot = new AWS.Iot();
const lambda = new AWS.Lambda();

// Set to true when debugging with a hard-coded user ID / token for testing.
const debugMode = false;


exports.handler = async function (request, context, callback) {

    log("DEBUG: ", "Alexa request:\n", JSON.stringify(request, null, 2));
    
    if (context !== undefined) {
        log("DEBUG: ", "Alexa context:\n", JSON.stringify(context,null, 2));
    }

    if (!('directive' in request)) {
 
        log("ERROR: ", `Request is missing 'directive' key.`);
 
        let alexaErrorResponse = new AlexaResponse(
            {
                "name": "ErrorResponse",
                "payload": {
                    "type": "INVALID_DIRECTIVE",
                    "message": "Missing key: directive, Is request a valid Alexa directive?"
                }
            }
        );
        
        return sendResponse(alexaErrorResponse.get());
    }

    if (request.directive.header.payloadVersion !== "3") {
    
        log("ERROR: ", `Request's payload version is `
            + `${request.directive.header.payloadVersion} but this function `
            + `requires version 3.`
        );
    
        let alexaErrorResponse = new AlexaResponse(
            {
                "name": "ErrorResponse",
                "payload": {
                    "type": "INTERNAL_ERROR",
                    "message": "This skill only supports Smart Home API version 3"
                }
            }
        );
        
        return sendResponse(alexaErrorResponse.get())
    }

    let namespace = ((request.directive || {}).header || {}).namespace;

    if (namespace.toLowerCase() === 'alexa.discovery') {

        log("DEBUG: ", "Calling handleDiscovery()...");
        let alexaResponse = await handleDiscovery(request, context, "");
        return sendResponse(alexaResponse.get());

    }
    else if (namespace.toLowerCase() === 'alexa.thermostatcontroller') {
 
        log("DEBUG: ", "Calling handleThermostatControl()...");
        let alexaResponse = await handleThermostatControl(request, context, "");
        return sendResponse(alexaResponse.get());
 
    }
    else {
 
        log("ERROR: ", `${namespace} is an unsupported Alexa namespace.`);
 
        let alexaErrorResponse = new AlexaResponse(
            {
                "name": "ErrorResponse",
                "payload": {
                    "type": "INVALID_DIRECTIVE",
                    "message": `Unsupported directive ${request.directive}.`
                }
            }
        );
        
        return sendResponse(alexaErrorResponse.get())

    }

};


/*
handleDiscovery is called by the Alexa service when the user asks Alexa (via
voice or app) to discover devices and should return a list of devices associated
to the user invoking the skill. Alexa passes an authentication token in the 
request which we must validate against the identity provider (IdP) you have
associated with the Smart Home skill in the Alexa Developer Console. If the 
token is valid and has not expired, we can proceed by parsing the token to 
obtain the user's ID and then making a call to our backend (e.g. AWS IoT Core, 
and/or a database) to find the device(s) (aka "endpoints") associated to our
user. We return the list of endpoints to Alexa. If an error occurs or no 
endpoints exist, we must return an empty list. 
*/
async function handleDiscovery(request, context) {

    let alexaResponse = new AlexaResponse(
        {
            "namespace": "Alexa.Discovery",
            "name": "Discover.Response"
        }
    );

    var authTokenValidationResponse = await getAuthTokenValidationResponse(
        request.directive.payload.scope.token
    );

    if (authTokenValidationResponse.hasOwnProperty('FunctionError')) {
    
        log("ERROR: ", "Authentication error:\n",
            JSON.stringify(authTokenValidationResponse, null, 2)
        );
    
        alexaResponse.setEndpointsToEmptyArrayDueToDiscoveryError();
    
    }
    else {
        
        var authToken = JSON.parse(authTokenValidationResponse.Payload);
        var userId = authToken.sub;

        var endpoints = await getUserEndpoints(userId);
        log("DEBUG: ", "User endpoints:\n", JSON.stringify(endpoints));
        
        endpoints.forEach(endpoint => {
            alexaResponse.addPayloadEndpoint(endpoint);
        });
    
    }

    return alexaResponse;

}

/*
This function receives a list of devices, each a JSON object, that are
associated to our user. This function selects the subset of properties from that
that list that are required by Alexa and pushes it into a new "endpoints" list
that becomes part of our final handleDiscovery response. 
*/
// DEPRECATED
function convertUserDevicesToEndpoints(userDevices) {
    var endpoints = [];
    for (var index in userDevices) {
        var userDevice = userDevices[index];
        var endpoint = {
            endpointId: userDevice.thingName,
            manufacturerName: userDevice.manufacturerName,
            friendlyName: userDevice.friendlyName,
            description: userDevice.description,
            displayCategories: userDevice.displayCategories,
            capabilities: userDevice.capabilities,
        };
        endpoints.push(endpoint);
    }
    return endpoints;
}


/*
This function calls another function to determine whether the auth token 
provided by Alexa during invocation is valid and not expired.  
*/
async function getAuthTokenValidationResponse(token) {

    var ignoreExpiredToken = false;

    if (debugMode === true) {

        log("DEBUG: ", "debugMode = true; expired auth tokens will be accepted"
            + "so long as the rest of the token is ok."
        );

        ignoreExpiredToken = true;
    }

    var payload = JSON.stringify({
        token: token,
        ignoreExpiredToken: ignoreExpiredToken
    });

    var params = {
        FunctionName: VERIFY_COGNITO_TOKEN_FUNCTION, 
        InvocationType: "RequestResponse", 
        Payload: payload
    };

    response = await lambda.invoke(params).promise();
    return response;

}

/*
This function takes a user ID obtained from the validated and not-expired auth
token provided by Alexa in the function request and invokes another function
that returns a list of all devices associated to that user. 
*/
async function getUserEndpoints(userId) {
//async function getUserDevices(userId) {
    
    var payload = JSON.stringify({
        userId: userId
    });

    var params = {
        FunctionName: GET_DEVICES_BY_USER_FUNCTION, 
        InvocationType: "RequestResponse", 
        Payload: payload
    };

    getUserDevicesResponse = await lambda.invoke(params).promise();
    var devices = (JSON.parse(getUserDevicesResponse.Payload)).deviceList;
    /*
        response will contain: {
            thingName: "xxxx",
            userId: "yyyy"
        }
    */

    let endpoints = [];

    devices.forEach(device => { 
        let iotDescription = await iot.describeThing({ thingName: device.thingName }).promise();

        thingConfig = discoveryConfig[iotDescription.modelNumber][iotDescription.firmwareVersion];

        let endpoint = {
            endpointId: device.thingName,
            manufacturerName: thingConfig.manufacturerName,
            friendlyName: thingConfig.friendlyName,
            description: thingConfig.description,
            displayCategories: thingConfig.displayCategories,
            capabilities: thingConfig.capabilities,
        };

        endpoints.push(endpoint);
    });

    return endpoints;
}

/*
Short-hand for logging messages...
*/
function log(message, message1, message2) {
    if (message2 == null) {
        console.log(message + message1);
    } else {
        console.log(message + message1 + message2);
    }
}

/*
This function handles all requests that Alexa identifies as being a 
"ThermostatController" directive, such as:
 - Turn device to cool mode
 - Turn device to heat mode
 - Increase device temperature
 - Decrease device temperature
 - Set temperature to X degrees

*/
async function handleThermostatControl(request, context) {

    let endpoint_id = request.directive.endpoint.endpointId;
    let token = request.directive.endpoint.scope.token;
    let correlationToken = request.directive.header.correlationToken;
    let requestMethod = request.directive.header.name; 


    var authTokenValidationResponse = await getAuthTokenValidationResponse(
        request.directive.endpoint.scope.token
    );

    if (authTokenValidationResponse.hasOwnProperty('FunctionError')) {

        log("ERROR: ", "Authentication error:\n",
            JSON.stringify(authTokenValidationResponse, null, 2)
        );

        alexaResponse.setEndpointsToEmptyArrayDueToDiscoveryError();

    } 
    else {

        var endpointId = request.directive.endpoint.endpointId;

        let alexaResponse = new AlexaResponse(
            {
                "correlationToken": correlationToken,
                "token": token,
                "endpointId": endpoint_id
            }
        );
        
        log("DEBUG: ", `Request method is ${requestMethod}...`);
    
        if (requestMethod === 'SetTargetTemperature') {
            
            // TODO - update the device shadow's desired state

            targetpointContextProperty = {
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
            log("DEBUG: ", `Updating shadow of ${endpointId}:\n`, JSON.stringify(shadowState,null,2));
            var updateShadowResponse = await iotdata.updateThingShadow(params).promise();
            log("DEBUG: ", `Update shadow response:\n`, JSON.stringify(updateShadowResponse,null,2));
            

            targetpointContextProperty = {
                namespace: "Alexa.ThermostatController",
                name: "thermostatMode",
                value: request.directive.payload.thermostatMode.value
            };
            alexaResponse.addContextProperty(targetpointContextProperty);
            return alexaResponse.get();
        }
        else {
            log("ERROR: ", `Unsupported request method ${requestMethod} for ThermostatController.`);
            return new AlexaResponse(
                {
                    "name": "ErrorResponse",
                    "payload": {
                        "type": "INTERNAL_ERROR",
                        "message": `Unsupported request method ${requestMethod} for ThermostatController.`
                    }
                }).get();
        }    
    }

}


function sendResponse(response)
{
    log("DEBUG: ", "Lambda response:\n", JSON.stringify(response, null, 2));
    return response
}