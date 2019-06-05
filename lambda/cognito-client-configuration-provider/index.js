// Adapted from https://github.com/rosberglinhares/CloudFormationCognitoCustomResources/blob/master/CloudFormationCognitoUserPoolClientSettings.js
const AWS = require('aws-sdk');

exports.handler = async (event, context, callback) => {

    console.log("REQUEST RECEIVED:\n" + JSON.stringify(event));
    let responseData, responseStatus;

    try {
        responseStatus = "SUCCESS";

        switch (event.RequestType) {
            case 'Create':
            case 'Update':
                var cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider();
                
                await cognitoIdentityServiceProvider.updateUserPoolClient({
                    UserPoolId: event.ResourceProperties.UserPoolId,
                    ClientId: event.ResourceProperties.UserPoolClientId,
                    SupportedIdentityProviders: event.ResourceProperties.SupportedIdentityProviders,
                    CallbackURLs: [event.ResourceProperties.CallbackURL],
                    LogoutURLs: [event.ResourceProperties.LogoutURL],
                    AllowedOAuthFlowsUserPoolClient: (event.ResourceProperties.AllowedOAuthFlowsUserPoolClient == 'true'),
                    AllowedOAuthFlows: event.ResourceProperties.AllowedOAuthFlows,
                    AllowedOAuthScopes: event.ResourceProperties.AllowedOAuthScopes
                }).promise();
                
                break;
                
            case 'Delete':
                await sendResponse(event, context, callback, 'SUCCESS');
                break;
        }
        
        console.info(`CognitoUserPoolClientSettings Success for request type ${event.RequestType}`);
    } catch (error) {
        console.error(`CognitoUserPoolClientSettings Error for request type ${event.RequestType}:`, error);
        responseStatus = "FAILED";
    }

    await sendResponse(event, context, callback, responseStatus);

}


async function sendResponse(event, context, callback, responseStatus, responseData) {

    var signedUrl = event.ResponseURL;
    var responseBody = JSON.stringify({
        Status: responseStatus,
        Reason: "See the details in CloudWatch Log Stream: " + context.logStreamName,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        PhysicalResourceId: event.LogicalResourceId,
        Data: responseData
    });

    console.log("RESPONSE BODY:\n", responseBody);
    
    var options = {
        method: 'put',
        headers:  {
            "content-type": "",
            "content-length": responseBody.length
        },
        data: responseBody
    };

    if (debug === true) {
        console.log('Debug=true; skipping post of results to signed S3 URL...');
    } else {
        console.log('Posting response to S3 signed URL...');
        response = await axios(signedUrl, options);
        console.log("STATUS: " + response.status);
        console.log("HEADERS: " + JSON.stringify(response.headers, null, 2));
    }
    callback(null);

}