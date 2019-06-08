const aws = require("aws-sdk");
const cognitoIdentityServiceProvider = new aws.CognitoIdentityServiceProvider();
const cfnResponse = require('cfn-response-async');

/*
  This function acts as a custom CloudFormation resource and therefore must
  handle one of three request types: Create, Update, or Delete. 
*/
exports.handler = async (event, context) => {

    console.log("REQUEST RECEIVED:\n" + JSON.stringify(event));

    let responseData; 

    try {
        if (event.RequestType === 'Create' || event.RequestType === 'Update') {
            
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

            responseData = {
                UserPoolId: event.ResourceProperties.UserPoolId,
                ClientId: event.ResourceProperties.UserPoolClientId
            };

            let physicalResourceId = event.LogicalResourceId;

            return await cfnResponse.send(event, context, "SUCCESS", responseData, physicalResourceId);
        }
        else if (event.RequestType === 'Delete') {
            // For now, we don't actually delete anything... but maybe we should reset values to default???
            return await cfnResponse.send(event, context, "SUCCESS");
        }
    }
    catch (err) {
        responseData = { Error: err };
        console.log(err);
        return await cfnResponse.send(event, context, "FAILED", responseData);
    }
}