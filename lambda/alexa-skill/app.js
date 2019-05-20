var AWS = require("aws-sdk");
var lambda = new AWS.Lambda();
var iot = new AWS.Iot(); 

// example helper library from Alexa team; some, but not all, is used.
let AlexaResponse = require("./AlexaResponse");

var GET_DEVICES_BY_USER_FUNCTION = process.env.GET_DEVICES_BY_USER_FUNCTION;
var VERIFY_COGNITO_TOKEN_FUNCTION = process.env.VERIFY_COGNITO_TOKEN_FUNCTION;

// Set to true when debugging with a hard-coded user ID / token for testing.
var debugMode = false;

exports.handler = async function (request, context, callback) {

    log("DEBUG: ", "Alexa request:\n", JSON.stringify(request, null, 2));
    
    if (context !== undefined) {
        log("DEBUG: ", "Alexa context:\n", JSON.stringify(context,null, 2));
    }

    // Validate we have an Alexa directive
    if (!('directive' in request)) {
        log("ERROR: ", `Request is missing 'directive' key.`);
        let alexaErrorResponse = new AlexaResponse(
            {
                "name": "ErrorResponse",
                "payload": {
                    "type": "INVALID_DIRECTIVE",
                    "message": "Missing key: directive, Is request a valid Alexa directive?"
                }
            });
        return sendResponse(alexaErrorResponse.get());
    }

    // Check the payload version
    if (request.directive.header.payloadVersion !== "3") {
        log("ERROR: ", `Request's payload version is ${request.directive.header.payloadVersion} but this function requires version 3.`);
        let alexaErrorResponse = new AlexaResponse(
            {
                "name": "ErrorResponse",
                "payload": {
                    "type": "INTERNAL_ERROR",
                    "message": "This skill only supports Smart Home API version 3"
                }
            });
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
        return new AlexaResponse(
            {
                "name": "ErrorResponse",
                "payload": {
                    "type": "INVALID_DIRECTIVE",
                    "message": `Unsupported directive ${request.directive}.`
                }
            }).get();
    }
};

async function handleDiscovery(request, context) {

    let alexaResponse = new AlexaResponse({"namespace": "Alexa.Discovery", "name": "Discover.Response"});
    var authTokenValidationResponse = await getAuthTokenValidationResponse(request.directive.payload.scope.token);

    if (authTokenValidationResponse.hasOwnProperty('FunctionError')) {
        log("ERROR: ", "Authentication error:\n", JSON.stringify(authTokenValidationResponse, null, 2));
        alexaResponse.setEndpointsToEmptyArrayDueToDiscoveryError();
    }
    else {
        var authToken = JSON.parse(authTokenValidationResponse.Payload);
        var userId = authToken.sub;
        var userDevices = await getUserDevices(userId);
        log("DEBUG: ", "User devices:\n", JSON.stringify(userDevices));
        var endpoints = convertUserDevicesToEndpoints(userDevices);
        log("DEBUG: ", "Endpoints:\n", JSON.stringify(endpoints));
        endpoints.forEach(endpoint => {
            alexaResponse.addPayloadEndpoint(endpoint);
        });
    }

    return alexaResponse;

}

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

async function getAuthTokenValidationResponse(token) {
    if (debugMode === true) {
        log("DEBUG: ", "debugMode = true; expired auth tokens will be accepted so long as the rest of the token is ok.");
    }
    var payload = {
        token: token,
        ignoreExpiredToken: debugMode
    }
    var payloadAsString = JSON.stringify(payload);
    var params = {
        FunctionName: VERIFY_COGNITO_TOKEN_FUNCTION, 
        InvocationType: "RequestResponse", 
        Payload: payloadAsString
    };
    response = await lambda.invoke(params).promise();
    return response;
}

async function getUserDevices(userId) {
    
    var payload = {
        userId: userId
    }
    var payloadAsString = JSON.stringify(payload);
    var params = {
        FunctionName: GET_DEVICES_BY_USER_FUNCTION, 
        InvocationType: "RequestResponse", 
        Payload: payloadAsString
    };
    getUserDevicesResponse = await lambda.invoke(params).promise();
    var payload = JSON.parse(getUserDevicesResponse.Payload);
    return payload.deviceList;
}

function log(message, message1, message2) {
    if (message2 == null) {
        console.log(message + message1);
    } else {
        console.log(message + message1 + message2);
    }
}

async function handleThermostatControl(request, context) {

    let endpoint_id = request.directive.endpoint.endpointId;
    let token = request.directive.endpoint.scope.token;
    let correlationToken = request.directive.header.correlationToken;
    let requestMethod = request.directive.header.name; 

    let alexaResponse = new AlexaResponse(
        {
            "correlationToken": correlationToken,
            "token": token,
            "endpointId": endpoint_id
        }
    );
    
    log("DEBUG: ", `Request method is ${requestMethod}...`);

    if (requestMethod === 'SetTargetTemperature') {
        
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
    
    /*
    var requestMethod = request.directive.header.name;
    var responseHeader = request.directive.header;
    responseHeader.namespace = "Alexa";
    responseHeader.name = "Response";
    responseHeader.messageId = responseHeader.messageId + "-R";
    var responseEndpoint = request.directive.endpoint;

    var contextResult = {
        properties: []      // not yet reporting properties
    };

    if (requestMethod === "SetTargetTemperature") {
        var targetSetPointProperty = {
            namespace: "Alexa.ThermostatController",
            name: "targetSetpoint",
            value: {
                value: request.directive.payload.targetSetpoint.value,
                scale: request.directive.payload.targetSetpoint.scale
            },
            timeOfSample: "2017-02-03T16:20:50.52Z",
            uncertaintyInMilliseconds: 500
        };

        var thermostatModeProperty = {
            namespace: "Alexa.ThermostatController",
            name: "thermostatMode",
            value: "HEAT",
            timeOfSample: "2017-02-03T16:20:50.52Z",
            uncertaintyInMilliseconds: 500
        };
        
        context.properties.push(targetSetPointProperty);
        context.properties.push(thermostatModeProperty);
        
    }
    else if (requestMethod === "AdjustTargetTemperature") {

    }
    else if (requestMethod === "SetThermostatMode") {

    } 
    else {
        // ERROR - unsupported directive
    }

    var response = {
        context: contextResult,
        event: {
            header: responseHeader,
            endpoint: responseEndpoint,
            payload: {}
        }
    };
    log("DEBUG: ", "Thermostat Control Response:\n", JSON.stringify(response));
    context.succeed(response);
    */
}

function sendResponse(response)
{
    // TODO Validate the response
    log("DEBUG: ", "Lambda response:\n", JSON.stringify(response, null, 2));
    return response
}