const aws = require("aws-sdk");
const iot = new aws.Iot();
const cfnResponse = require('cfn-response-async');

/* 
 This function is meant to act as a custom CloudFormation resource which
 generates obtains your AWS account's particular IoT Endpoint and stores it
 as a retrievable property of the CloudFormation resource. 
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
            var response = await iot.describeEndpoint({}).promise();
            var endpointAddress = response.endpointAddress;
            var physicalResourceId = endpointAddress;
            responseData = { IotEndpointAddress: endpointAddress };
            return await cfnResponse.send(event, context, "SUCCESS", responseData, physicalResourceId);
        }
    } 
    catch (err) {
        responseData = { Error: err };
        console.log(err);
        return await cfnResponse.send(event, context, "FAILED", responseData);
    }
};
