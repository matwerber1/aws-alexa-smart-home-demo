const uuidv4 = require('uuid/v4');
const cfnResponse = require('cfn-response-async');

/* 
 This function is meant to act as a custom CloudFormation resource which
 generates a random v4 UUID. This could be used to generate an external ID
 for a Cognito SMS configuration and corresponding IAM role's trust policy, 
 or anything else that needs a UUID. 
*/
exports.handler = async (event, context) => {

    console.log("REQUEST RECEIVED:\n" + JSON.stringify(event));
    
    let responseData; 

    try {
        if (event.RequestType == "Delete") {
            // There's nothing to delete, so just send a success response
            return await cfnResponse.send(event, context, "SUCCESS");
        }
        else if (event.RequestType === "Create" || event.RequestType === "Update") {
            let uuid = uuidv4();
            let physicalResourceId = uuid;
            responseData = { uuid: uuid };
            return await cfnResponse.send(event, context, "SUCCESS", responseData, physicalResourceId);
        }    
    }
    catch (err) {
        responseData = { Error: err };
        console.log(err);
        return await cfnResponse.send(event, context, "FAILED", responseData);
    }

};