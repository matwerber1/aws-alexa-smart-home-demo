const aws = require("aws-sdk");
const cfnResponse = require('cfn-response-async');
const cognito = new aws.CognitoIdentityServiceProvider();
const secretsmanager = new aws.SecretsManager();

/*
  This function acts as a custom CloudFormation resource and therefore must
  handle one of three request types: Create, Update, or Delete. 
*/
exports.handler = async (event, context) => {
  
    console.log("REQUEST RECEIVED:\n" + JSON.stringify(event));
    
    var responseData;
    var stackName = (event.StackId).split('/')[1];
    var logicalResourceId = event.LogicalResourceId; 

    try {
        if (event.RequestType === 'Create' || event.RequestType === 'Update') {

            // Error handling checks....
            if (event.ResourceProperties.hasOwnProperty('RecoveryWindowInDays')
                && event.ResourceProperties.hasOwnProperty('ForceDeleteWithoutRecovery')
                )
            {
                throw ('Cannot simultaneously specify RecoveryWindowInDays and ForceDeleteWithoutRecovery '
                    + 'in properties; must specify one or neither(default is 7 day recovery retention).')
                ;
            }
            else if (event.ResourceProperties.hasOwnProperty('UserPoolId') === false) {
                throw ("Resource parameters missing required property 'UserPoolId'");
            }
            else if (event.ResourceProperties.hasOwnProperty('AppClientId') === false) {
                throw ("Resource parameters missing required property 'AppClientId'");
            }

            // The 'Create' and 'Update' are largely the same, though a few
            // differences when it comes to the interaction with Secrets Manager.
            // I opted to combine the logic in a single block. 

            let userPoolId = event.ResourceProperties.UserPoolId;
            let clientId = event.ResourceProperties.AppClientId;
            
            let clientDescription = await cognito.describeUserPoolClient({
                UserPoolId: userPoolId,
                ClientId: clientId
            }).promise();
            
            // This is the JSON object we will store in AWS Secrets Manager:
            let secretPayload = {
                userPoolId: userPoolId,
                clientId: clientId,
                clientSecret: clientDescription.UserPoolClient.ClientSecret
            };

            // Generate or use existing secret name
            let secretName;
            if (event.RequestType === 'Create') {
                secretName = generateSecretName(stackName, logicalResourceId);
            }
            else if (event.RequestType === 'Update') {
                secretName = event.PhysicalResourceId;
            }

            console.log('Secret name is: ' + secretName);

            let secretDescription = `App client secret for app ${clientId} of Cognito user pool`
                + ` ${userPoolId} for logical resource ${logicalResourceId}`
                + ` in CloudFormation stack ${stackName}`
            ;

            let secretsManagerParams = {
                Description: secretDescription, 
                SecretString: JSON.stringify(secretPayload)
            };

            // Parameters and API call depends on Create vs. Update
            let secretResponse;

            if (event.RequestType === 'Create') {
                secretsManagerParams.Name = secretName;
                secretsManagerParams.Tags = [
                    {
                        Key: 'custom:cloudformation:stack-name',
                        Value: stackName
                    },
                    {
                        Key: 'custom:cloudformation:logical-id',
                        Value: logicalResourceId
                    }
                ];
                console.log('API params are: \n' + JSON.stringify(secretsManagerParams, null, 2));
                secretResponse = await secretsmanager.createSecret(secretsManagerParams).promise();
            }
            else if (event.RequestType === 'Update') {
                secretsManagerParams.SecretId = secretName;
                console.log('API params are: \n' + JSON.stringify(secretsManagerParams, null, 2));
                secretResponse = await secretsmanager.updateSecret(secretsManagerParams).promise();
            }

            responseData = {
                SecretArn: secretResponse.ARN,
                SecretName: secretResponse.Name,
                SecretVersionId: secretResponse.secretVersionId
            };
            let physicalResourceId = secretResponse.Name;

            return await cfnResponse.send(event, context, "SUCCESS", responseData, physicalResourceId);
        }
        else if (event.RequestType === 'Delete') {

            // If the CloudFormation template did not specify either of the two delete parameters below, 
            // then we will use a default recoveryWindowInDays of 7 just to be safe that we don't lose
            // an important secret by mistake. 
            if (event.ResourceProperties.hasOwnProperty('RecoveryWindowInDays') === false
                && event.ResourceProperties.hasOwnProperty('ForceDeleteWithoutRecovery' === false)
            ) {
                event.ResourceProperties.RecoveryWindowInDays = 7;
            }
            
            // In params below, only one or neither of RecoveryWindowInDays or ForceDeleteWithoutRecovery
            // will be present in the ResourceProperties because we block the initial Create or Update
            // if both properties are specified. 
            var deleteParams = {
                SecretId: event.PhysicalResourceId,
                RecoveryWindowInDays: event.ResourceProperties.RecoveryWindowInDays,
                ForceDeleteWithoutRecovery: event.ResourceProperties.ForecDeleteWithoutRecovery
            };

            await secretsmanager.deleteSecret(deleteParams).promise();
            return await cfnResponse.send(event, context, "SUCCESS");
        }
    } catch (err) {
        responseData = { Error: err };
        console.log(err);
        return await cfnResponse.send(event, context, "FAILED", responseData);
    }
};

/*
  This function generates a resource name for our AWS Secret in a format similar
  to those automatically generated by CloudFormation, i.e. a concatenation of
  stackName-resourceName-<RANDOM>, where <RANDOM> is 12 capitalized 
  alpha/numeric characters. 
*/
function generateSecretName(stackName, logicalResourceId) {
    var result           = `${stackName}-${logicalResourceId}-`;
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < 12; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
 }