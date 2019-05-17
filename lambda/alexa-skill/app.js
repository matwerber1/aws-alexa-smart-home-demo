var AWS = require("aws-sdk");
var lambda = new AWS.Lambda();

var GET_DEVICES_BY_USER_FUNCTION = process.env.GET_DEVICES_BY_USER_FUNCTION;
var VERIFY_COGNITO_TOKEN_FUNCTION = process.env.VERIFY_COGNITO_TOKEN_FUNCTION;

// Set to true when debugging with a hard-coded user ID / token for testing.
var debugMode = true;
var debugVars = {
    userId: '4b8224a1-5fd5-44cb-95f2-db1a2d89b2fb',
    endpoints: [
        {
            "endpointId": "demo_id",
            "manufacturerName": "Smart Device Company",
            "friendlyName": "Bedroom Outlet",
            "description": "Smart Device Switch",
            "displayCategories": ["SWITCH"],
            "cookie": {
                "key1": "arbitrary key/value pairs for skill to reference this endpoint.",
                "key2": "There can be multiple entries",
                "key3": "but they should only be used for reference purposes.",
                "key4": "This is not a suitable place to maintain current endpoint state."
            },
            "capabilities":
            [
                {
                "type": "AlexaInterface",
                "interface": "Alexa",
                "version": "3"
                },
                {
                    "interface": "Alexa.PowerController",
                    "version": "3",
                    "type": "AlexaInterface",
                    "properties": {
                        "supported": [{
                            "name": "powerState"
                        }],
                        "retrievable": true
                    }
                }
            ]
        }
    ]
}

exports.handler = async function (request, context, callback) {

    if (request.directive.header.namespace === 'Alexa.Discovery' && request.directive.header.name === 'Discover') {
        log("DEBUG: ", "Discover request: \n", JSON.stringify(request,null, 2));
        await handleDiscovery(request, context, "");
    }
    else if (request.directive.header.namespace === 'Alexa.PowerController') {
        if (request.directive   .header.name === 'TurnOn' || request.directive.header.name === 'TurnOff') {
            log("DEBUG: ", "TurnOn or TurnOff Request", JSON.stringify(request));
            handlePowerControl(request, context);
        }
    }

    async function handleDiscovery(request, context) {

        var header = request.directive.header;
        header.name = "Discover.Response";
        var endpoints = [];
        var authTokenValidationResponse = await getAuthTokenValidationResponse(request.directive.payload.scope.token);

        // Check whether auth token is valid
        if (authTokenValidationResponse.hasOwnProperty('FunctionError')) {
            // Per docs, if an error occurs for discovery, we still return a
            // normal response, but the endpoints array must be empty. So, 
            // all we can really do is print debugging messages on error.
            // Per docs (https://developer.amazon.com/docs/device-apis/alexa-discovery.html) 
            log("DEBUG: ", "Discovery error:\n", JSON.stringify(authTokenValidationResponse, null, 2));
        } else {
            var authToken = JSON.parse(authTokenValidationResponse.Payload);

            // A Cognito sub is a unique id within the pool, separate from the username.
            // In some cases, it's possible a user could their username, whereas the
            // the sub is never changes. Hence, the sub is the better unique identifier.
            // Depending on configuration, a Cognito sub and username might hold the same
            // value, but we should still always use sub for pulling user data from Cognito. 
            var userId = authToken.sub;
            console.log(`Calling getUserDevices() for user ${userId}...`)
            var userDevices = await getUserDevices(userId);
            log("DEBUG: ", "User devices:\n", JSON.stringify(userDevices, null, 2));
            
            //endpoints = ...
        } 

        var payload = {
            endpoints: endpoints
        };
        log("DEBUG: ", "Discovery Response:\n", JSON.stringify({ header: header, payload: payload }, null, 2));
        context.succeed({ event: { header: header, payload: payload } });
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
        return getUserDevicesResponse.Payload.deviceList;
    }

    function log(message, message1, message2) {
        if (message2 == null) {
            console.log(message + message1);
        } else {
            console.log(message + message1 + message2);
        }
    }

    function handlePowerControl(request, context) {
        // get device ID passed in during discovery
        var requestMethod = request.directive.header.name;
        var responseHeader = request.directive.header;
        responseHeader.namespace = "Alexa";
        responseHeader.name = "Response";
        responseHeader.messageId = responseHeader.messageId + "-R";
        // get user token pass in request
        var requestToken = request.directive.endpoint.scope.token;
        var powerResult;

        if (requestMethod === "TurnOn") {

            // Make the call to your device cloud for control
            // powerResult = stubControlFunctionToYourCloud(endpointId, token, request);
            powerResult = "ON";
        }
    else if (requestMethod === "TurnOff") {
            // Make the call to your device cloud for control and check for success
            // powerResult = stubControlFunctionToYourCloud(endpointId, token, request);
            powerResult = "OFF";
        }
        var contextResult = {
            "properties": [{
                "namespace": "Alexa.PowerController",
                "name": "powerState",
                "value": powerResult,
                "timeOfSample": "2017-09-03T16:20:50.52Z", //retrieve from result.
                "uncertaintyInMilliseconds": 50
            }]
        };
        var response = {
            context: contextResult,
            event: {
                header: responseHeader,
                endpoint: {
                    scope: {
                        type: "BearerToken",
                        token: requestToken
                    },
                    endpointId: "demo_id"
                },
                payload: {}
            }
        };
        log("DEBUG", "Alexa.PowerController ", JSON.stringify(response));
        context.succeed(response);
        //callback(null, response);
    }
};