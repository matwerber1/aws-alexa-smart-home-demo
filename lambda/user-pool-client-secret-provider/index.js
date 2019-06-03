//const https = require("https");
const axios = require("axios");
const url = require("url");

const aws = require("aws-sdk");
const cognito = new aws.CognitoIdentityServiceProvider();
const secretsmanager = new aws.SecretsManager();

const debug = false; 

/*
  This function acts as a custom CloudFormation resource and therefore must
  handle one of three request types: Create, Update, or Delete. 
*/
exports.handler = async function (event, context, callback) {
  
    console.log("REQUEST RECEIVED:\n" + JSON.stringify(event));

    const userPoolId = event.ResourceProperties.UserPoolId;
    const appClientId = event.ResourceProperties.AppClientId;
    const stackName = event.ResourceProperties.StackName;
    const resourceId = event.LogicalResourceId;
    const requestType = event.RequestType; 
    let responseData, responseStatus; 

    if (requestType == "Delete") {
        try {
            console.log('Deleting secret in AWS Secrets Manager...');
            var secretName = event.PhysicalResourceId;
            var secretPayload = {
                UserPoolId: userPoolId,
                ClientId: appClientId,
                ClientSecret: clientSecret
            };
            var params = {
                SecretId: secretName,
                RecoveryWindowInDays: 7
            };
            var secretResponse = await secretsmanager.deleteSecret(params).promise();
            responseData = {
                secretArn: secretResponse.ARN,
                secretName: secretResponse.Name, 
                secretVersionId: secretResponse.secretVersionId
            };
            console.log('Delete secret response data: ' + JSON.stringify(responseData));
            responseStatus = "SUCCESS";
        }
        catch (err) {
            responseStatus = "FAILED";
            responseData = { Error: "Delete of client app secret failed." };
            console.log(responseData.Error + ":\n", err);
        }
    }
    else if (requestType === "Create") {
        try {
            var params = {
                UserPoolId: userPoolId,
                ClientId: appClientId
            };
            // First, get the app client secret value: 
            console.log('Getting app client secret from Cognito...')
            var describeResponse = await cognito.describeUserPoolClient(params).promise();
            var clientSecret = describeResponse.UserPoolClient.ClientSecret;
            console.log('Storing secret in AWS Secrets Manager...');            
            var secretName;
            if (debug === true) {
                secretName = 'mySmartHomeDebugAppClientSecret';
                clientSecret = 'mySecret'
            } else {
                secretName = generateSecretName(stackName, resourceId); 
            } 
            var secretPayload = {
                userPoolId: userPoolId,
                clientId: appClientId,
                clientSecret: clientSecret
            };
            var params = {
                Description: `App client secret for app ${appClientId} of Cognito user pool ${userPoolId} for CF stack ${stackName}`, 
                Name: secretName, 
                SecretString: JSON.stringify(secretPayload),
                Tags: [
                    {
                        Key: 'custom:cloudformation:stack-name',
                        Value: stackName
                    },
                    {
                        Key: 'custom:cloudformation:logical-id',
                        Value: resourceId
                    },
                    {
                        Key: 'custom:cloudformation:created-by',
                        Value: 'lambda function ' + process.env.AWS_LAMBDA_FUNCTION_NAME
                    },
                ]
               };
            var secretResponse = await secretsmanager.createSecret(params).promise();
            responseData = {
                SecretArn: secretResponse.ARN,
                SecretName: secretResponse.Name, 
                SecretVersionId: secretResponse.secretVersionId
            };
            console.log('Create secret response data: ' + JSON.stringify(responseData));
            responseStatus = "SUCCESS";
        }
        catch (err) {
            responseStatus = "FAILED";
            responseData = { Error: "Create client app secret failed." };
            console.log(responseData.Error + ":\n", err);
        }
    }
    else if (requestType === "Update") {
        try {
            console.log('Updating secret in AWS Secrets Manager...');
            var secretName = event.PhysicalResourceId;
            console.log('secret name is ' + secretName)
            var secretPayload = {
                UserPoolId: userPoolId,
                ClientId: appClientId,
                ClientSecret: clientSecret
            };
            var params = {
                SecretId: secretName,
                Description: `App client secret for app ${appClientId} of Cognito user pool ${userPoolId} for CF stack ${stackName}`, 
                SecretString: JSON.stringify(secretPayload),
            };
            var secretResponse = await secretsmanager.updateSecret(params).promise();
            responseData = {
                SecretArn: secretResponse.ARN,
                SecretName: secretResponse.Name, 
                SecretVersionId: secretResponse.secretVersionId
            };
            console.log('Update secret response data: ' + JSON.stringify(responseData));
            responseStatus = "SUCCESS";
        }
        catch (err) {
            responseStatus = "FAILED";
            responseData = { Error: "Update of client app secret failed." };
            console.log(responseData.Error + ":\n", err);
        }
    } else {
        responseStatus = "FAILED";
        responseData = { Error: "Invalid requestType of '${requestType}'." };
        console.log(responseData.Error + ":\n", err);
    }

    await sendResponse(event, context, callback, responseStatus, responseData);

};

// Send response to the pre-signed S3 URL 
async function sendResponse(event, context, callback, responseStatus, responseData) {

    var signedUrl = event.ResponseURL;
    var responseBody = JSON.stringify({
        Status: responseStatus,
        Reason: "See the details in CloudWatch Log Stream: " + context.logStreamName,
        //PhysicalResourceId: context.logStreamName,
        PhysicalResourceId: responseData.SecretName,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
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



    /*
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
    */
}


/*
  This function generates a resource name for our AWS Secret in a format similar
  to those automatically generated by CloudFormation, i.e. a concatenation of
  stackName-resourceName-<RANDOM>, where <RANDOM> is 12 capitalized 
  alpha/numeric characters. 
*/
function generateSecretName(stackName, resourceId) {
    var result           = `${stackName}-${resourceId}-`;
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < 12; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
 }