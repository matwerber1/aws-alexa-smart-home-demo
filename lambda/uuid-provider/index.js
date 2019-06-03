const uuidv4 = require('uuid/v4');


/* 
 This function is meant to act as a custom CloudFormation resource which
 generates a random v4 UUID. This could be used to generate an external ID
 for a Cognito SMS configuration and corresponding IAM role's trust policy, 
 or anything else that needs a UUID. 
*/
exports.handler = function (event, context) {

    console.log("REQUEST RECEIVED:\n" + JSON.stringify(event));

    // For Delete requests, immediately send a SUCCESS response.
    if (event.RequestType == "Delete") {
        sendResponse(event, context, "SUCCESS");
        return;
    }

    let responseData, responseStatus; 

    try {
        responseStatus = "SUCCESS";
        responseData = { uuid: uuidv4() };
        console.log('response data: ' + JSON.stringify(responseData));
    }
    catch (err) {
        responseStatus = "FAILED";
        responseData = { Error: "Generation of UUIDv4 failed" };
        console.log(responseData.Error + ":\n", err);
    }
    
    sendResponse(event, context, responseStatus, responseData);

};

// Send response to the pre-signed S3 URL 
function sendResponse(event, context, responseStatus, responseData) {

    var responseBody = JSON.stringify({
        Status: responseStatus,
        Reason: "See the details in CloudWatch Log Stream: " + context.logStreamName,
        PhysicalResourceId: context.logStreamName,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Data: responseData
    });

    console.log("RESPONSE BODY:\n", responseBody);

    var https = require("https");
    var url = require("url");

    var parsedUrl = url.parse(event.ResponseURL);
    var options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.path,
        method: "PUT",
        headers: {
            "content-type": "",
            "content-length": responseBody.length
        }
    };

    console.log("SENDING RESPONSE...\n");

    var request = https.request(options, function(response) {
        console.log("STATUS: " + response.statusCode);
        console.log("HEADERS: " + JSON.stringify(response.headers));
        // Tell AWS Lambda that the function execution is done  
        context.done();
    });

    request.on("error", function(error) {
        console.log("sendResponse Error:" + error);
        // Tell AWS Lambda that the function execution is done  
        context.done();
    });

    // write data to request body
    request.write(responseBody);
    request.end();
}