const AWS = require("aws-sdk");

const GET_DEVICES_BY_USER_FUNCTION = process.env.GET_DEVICES_BY_USER_FUNCTION;
const VERIFY_COGNITO_TOKEN_FUNCTION = process.env.VERIFY_COGNITO_TOKEN_FUNCTION;
const IOT_ENDPOINT = process.env.IOT_ENDPOINT;

const AlexaResponse = require("./AlexaResponse");
const discoveryConfig = require ("./discoveryConfig");
const iotdata = new AWS.IotData({ endpoint: IOT_ENDPOINT });
const iot = new AWS.Iot();
const lambda = new AWS.Lambda();
const REQUIRED_PAYLOAD_VERSION = "3";

exports.handler = async function (request, context) {

    try {
        log("Alexa request:\n", request);
        log("Alexa context:\n", context);

        if (!('directive' in request)) {
            return sendErrorResponse(
                'INVALID_DIRECTIVE',
                'directive is missing from request'
            );
        }
        
        let header = request.directive.header;
        let namespace = header.namespace; 
        // This was in an example but its an odd statement 
        //let namespace = ((request.directive || {}).header || {}).namespace;

        if (header.payloadVersion !== REQUIRED_PAYLOAD_VERSION) {
            return sendErrorResponse(
                'INVALID_DIRECTIVE', 
                `Payload v${header.payloadVersion} unsupported.`
                + `Expected v${REQUIRED_PAYLOAD_VERSION}`
            );
        }
        
        var authResponse = await getAuthTokenValidationResponse(
            request.directive.payload.scope.token
        );
        if (authResponse.hasOwnProperty('FunctionError')) {
            let authError = JSON.parse(authResponse.Payload);
            if (authError.errorMessage === 'Token is expired') {
                return sendErrorResponse(
                    'EXPIRED_AUTHORIZATION_CREDENTIAL', 
                    `Auth token is expired`
                );
            }
            else {
                return sendErrorResponse(
                    'INVALID_AUTHORIZATION_CREDENTIAL', 
                    `Auth token invalid`
                );
            }
        }

        var authToken = JSON.parse(authResponse.Payload);

        if (namespace.toLowerCase() === 'alexa.discovery') {
            let response = await handleDiscovery(request, context, authToken);
            return sendResponse(response.get());
    
        }
        else if (namespace.toLowerCase() === 'alexa.thermostatcontroller') {
            let response = await handleThermostatControl(request, context);
            return sendResponse(response.get());
        }
            
        else {       
            return sendErrorResponse(
                'INVALID_DIRECTIVE', 
                `Namespace ${namespace} is unsupported by this skill.`
            );
        }
    }
    catch (err) {
        log('ERROR:\n', err);
        return sendErrorResponse(
            'INTERNAL_ERROR', 
            `Unhandled error: ${err}`
        );
    }

};

async function handleDiscovery(request, context, authToken) {

    try {
        log("Calling handleDiscovery()");
    
        let alexaResponse = new AlexaResponse({
            "namespace": "Alexa.Discovery",
            "name": "Discover.Response"
        });

        var userId = authToken.sub;
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


/*
This function calls another function to determine whether the auth token 
provided by Alexa during invocation is valid and not expired.  
*/
async function getAuthTokenValidationResponse(token) {

    try {
        var params = {
            FunctionName: VERIFY_COGNITO_TOKEN_FUNCTION, 
            InvocationType: "RequestResponse", 
            Payload: JSON.stringify({ token: token })
        };
    
        let response = await lambda.invoke(params).promise();
        return response;
    }
    catch (err) {
        throw (`Error invoking ${VERIFY_COGNITO_TOKEN_FUNCTION}: ${err}`);
    }


}

/*
This function takes a user ID obtained from the validated and not-expired auth
token provided by Alexa in the function request and invokes another function
that returns a list of all devices associated to that user. 
*/
async function getUserEndpoints(userId) {

    log("Getting user endpoints");
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

/*
Short-hand for logging messages
*/
function log(message1, message2) {
    if (message2 == null) {
        console.log(message1);
    } else {
        console.log(message1 + JSON.stringify(message2, null, 2));
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
    log("Calling handleThermostatControl()");
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

    var authTokenValidationResponse = await getAuthTokenValidationResponse(
        request.directive.endpoint.scope.token
    );

    if (authTokenValidationResponse.hasOwnProperty('FunctionError')) {
        log("ERROR: Authentication error:\n", authTokenValidationResponse);
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
        
        log(`Request method is ${requestMethod}`);
    
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
            log(`Updating shadow of ${endpointId}:\n`, shadowState);
            var updateShadowResponse = await iotdata.updateThingShadow(params).promise();
            log(`Update shadow response:\n`, updateShadowResponse);
            


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
    log("Lambda response:\n", response);
    return response
}

function sendErrorResponse(type, message) {
    let alexaErrorResponse = new AlexaResponse({
        "name": "ErrorResponse",
        "payload": {
            "type": type,
            "message": message
        }
    });
    return sendResponse(alexaErrorResponse.get());
}