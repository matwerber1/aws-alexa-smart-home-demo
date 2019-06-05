const axios = require("axios");
const aws = require("aws-sdk");
const cognito = new aws.CognitoIdentityServiceProvider();
const secretsmanager = new aws.SecretsManager();

// if debug = true, we skip the step of attempting to post results to a signed
// S3 URL as our test event would, in theory, contain a static / old / invalid
// S3 URL instead of the freshly-generated URL that is received during a real
// CloudFormation deployment:
const debug = false; 
// If true, secrets are deleted immediately and not recoverable;
// If false, secrets are deleted but may be recovered within 7 days if needed: 
const deleteImmediately = false; 
const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME;


/*
  This function acts as a custom CloudFormation resource and therefore must
  handle one of three request types: Create, Update, or Delete. 
*/
exports.handler = async function (event, context, callback) {
  
    console.log("REQUEST RECEIVED:\n" + JSON.stringify(event));
    let responseData, responseStatus;

    try {

        // Given that a stack ID is in the format arn:aws:cloudformation:REGION:ACCOUNT:stack/STACKNAME/VERSION,
        // We can parse the stack name from the stack ID by splitting on a '/':
        const stackName = (event.StackId).split('/')[1];
        const userPoolId = event.ResourceProperties.UserPoolId;
        const appClientId = event.ResourceProperties.AppClientId;
        const resourceId = event.LogicalResourceId;
        const requestType = event.RequestType;
        responseStatus = "SUCCESS";

        if (requestType === "Create") {
        
            console.log('Getting app client secret from Cognito...');
            var describeResponse = await cognito.describeUserPoolClient(
                {
                    UserPoolId: userPoolId,
                    ClientId: appClientId
                }
            ).promise();
            
            console.log('Storing secret in AWS Secrets Manager...');
            var clientSecret = describeResponse.UserPoolClient.ClientSecret;
            var secretName = generateSecretName(stackName, resourceId);

            var secretPayload = {
                userPoolId: userPoolId,
                clientId: appClientId,
                clientSecret: clientSecret
            };

            var createSecretParams = {
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
                        Value: 'lambda function ' + functionName
                    },
                ]
            };
            
            var secretResponse = await secretsmanager.createSecret(
                createSecretParams
            ).promise();

            responseData = {
                SecretArn: secretResponse.ARN,
                SecretName: secretResponse.Name,
                SecretVersionId: secretResponse.secretVersionId
            };
        }
        else if (requestType === "Update") {

            console.log('Getting app client secret from Cognito...')
            var describeResponse = await cognito.describeUserPoolClient(
                {
                    UserPoolId: userPoolId,
                    ClientId: appClientId
                }
            ).promise();
        
            var clientSecret = describeResponse.UserPoolClient.ClientSecret;

            console.log('Updating secret in AWS Secrets Manager...');
            var secretName = event.PhysicalResourceId;
            var secretPayload = {
                UserPoolId: userPoolId,
                ClientId: appClientId,
                ClientSecret: clientSecret
            };
            var updateSecretParams = {
                SecretId: secretName,
                Description: `App client secret for app ${appClientId} of Cognito user pool ${userPoolId} for CF stack ${stackName}`,
                SecretString: JSON.stringify(secretPayload),
            };
            var secretResponse = await secretsmanager.updateSecret(updateSecretParams).promise();
            responseData = {
                SecretArn: secretResponse.ARN,
                SecretName: secretResponse.Name,
                SecretVersionId: secretResponse.secretVersionId
            };
            console.log('Update secret response data: ' + JSON.stringify(responseData));
        }
        else if (requestType == "Delete") {

            console.log('Deleting secret in AWS Secrets Manager...');
            var secretName = event.PhysicalResourceId;
            var secretPayload = {
                UserPoolId: userPoolId,
                ClientId: appClientId,
                ClientSecret: clientSecret
            };
            var deleteParams = {
                SecretId: secretName
            };

            if (deleteImmediately === false) {
                deleteParams.RecoveryWindowInDays = 7;
            } else {
                deleteParams.ForceDeleteWithoutRecovery = true;
            }

            var secretResponse = await secretsmanager.deleteSecret(deleteParams).promise();
            responseData = {
                SecretArn: secretResponse.ARN,
                SecretName: secretResponse.Name
            };
            console.log('Delete secret response data: ' + JSON.stringify(responseData));
        }
        else {
            throw new Error(`Invalid requestType of '${requestType}'.`);
        }
    }
    catch (err) {
        responseStatus = "FAILED";
        responseData = { Error: err };
        console.log(responseData.Error + ":\n", err);
    }

    await sendResponse(event, context, callback, responseStatus, responseData);

};



async function sendResponse(event, context, callback, responseStatus, responseData) {

    var signedUrl = event.ResponseURL;
    var responseBody = JSON.stringify({
        Status: responseStatus,
        Reason: "See the details in CloudWatch Log Stream: " + context.logStreamName,
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