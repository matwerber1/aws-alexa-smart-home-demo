// Adapted from https://github.com/rosberglinhares/CloudFormationCognitoCustomResources/

const axios = require('axios');
const AWS = require('aws-sdk');
var cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider();
const debug = false; 


exports.handler = async function (event, context, callback) {
    
    console.log("REQUEST RECEIVED:\n" + JSON.stringify(event));
    let responseData, responseStatus;

    try {
        responseStatus = "SUCCESS";

        switch (event.RequestType) {
            case 'Create':
                await cognitoIdentityServiceProvider.createUserPoolDomain(
                    {
                        UserPoolId: event.ResourceProperties.UserPoolId,
                        Domain: event.ResourceProperties.DomainPrefix,
                    }
                ).promise();
                responseData = {
                    DomainPrefix: event.ResourceProperties.DomainPrefix,
                    FullDomain: getFullDomain(event.ResourceProperties.DomainPrefix)
                };
                break;
                
            case 'Update':
                /* Even though an UpdateUserPoolDomain() API exists, it is used for changing the 
                   SSL certificate of a custom domain; it cannot change the actual domain name.
                   Therefore, to perform an update, we have to first delete the old domain name
                   and then create a new one in Cognito. This differs from the 'standard' 
                   CloudFormation replace behavior in that CloudFormation typically will first
                   create the new resource and, only if the create is successful, will it delete
                   the old resource. The Cognito domain is different in that a user pool cannot
                   have two domains (e.g. an old one and a new one). So, we have to do things
                   in reverse order. Upon update, we have to first delete the old domain
                   and then create the new one. This is also why we *must* always return the
                   same PhysicalResourceId in our response. If we were to return a different
                   resource ID (e.g. an ID based on the domain value itself), then we would
                   trigger CloudFormation's standard procedure of first issuing an Update command
                   to our Lambda and, after update success, issuing a Delete command to the Lambda. 
                   Again, because a single user pool cannot have two domains, this would lead to
                   unexpected behavior (e.g. a missing domain name upon the second delete).
                   That is why our PhysicalResourceId is simply the LogicalResourceId from the
                   CF template. The ID stays the same unless we delete the resource itself. 
                */
                // Delete the old domain
                await deleteUserPoolDomain(event.OldResourceProperties.DomainPrefix);
                
                // Create the new domain
                await cognitoIdentityServiceProvider.createUserPoolDomain({
                    UserPoolId: event.ResourceProperties.UserPoolId,
                    Domain: event.ResourceProperties.DomainPrefix
                }).promise();

                responseData = {
                    DomainPrefix: event.ResourceProperties.DomainPrefix, 
                    FullDomain: getFullDomain(event.ResourceProperties.DomainPrefix)
                };
                break;
                
            case 'Delete':
                await deleteUserPoolDomain(event.ResourceProperties.DomainPrefix);
                break;
        }
        console.info(`CognitoUserPoolDomain Success for request type ${event.RequestType}`);
    } catch (error) {
        console.error(`CognitoUserPoolDomain Error for request type ${event.RequestType}:`, error);
        responseStatus = "FAILED";
    }

    await sendResponse(event, context, callback, responseStatus, responseData);
}


function getFullDomain(domainPrefix) {
    var fullDomain = (
        'https://'
        + domainPrefix
        + '.auth.'
        + process.env.AWS_REGION
        + '.amazoncognito.com'
    );
    return fullDomain; 
}

/*
Describe the domain to determine its UserPoolId. Note that this describe API
will return the owning User Pool ID regardless of which AWS account owns the pool. 
The API call will return an error if the domain does not exist. 
*/
async function deleteUserPoolDomain(domain) {
    var response = await cognitoIdentityServiceProvider.describeUserPoolDomain({
        Domain: domain
    }).promise();
    
    if (response.DomainDescription.Domain) {
        await cognitoIdentityServiceProvider.deleteUserPoolDomain({
            UserPoolId: response.DomainDescription.UserPoolId,
            Domain: domain
        }).promise();
    }
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