var util = require("util");
var AWS = require("aws-sdk");
var dynamodb = new AWS.DynamoDB();

var deviceTableName = process.env.DEVICE_TABLE;

exports.handler = async (event) => {

    try {
        console.log(`Received event:\n${util.inspect(event)}`);
        await associateDeviceToUser(event.userId, event.thingName);
        const response = {
            statusCode: 200,
            message: `User ${event.userId} associated to thing ${event.thingName}`
        };
        return response;
    } catch (error) {
        console.log(`Error:\n${error}`);
        const response = {
            statusCode: 500,
            error: {
                type: (error.constructor.name),
                message: error.message
            }
        };
        return response;
    }
};


async function associateDeviceToUser(userId, thingName) {

    var hashId = "userId_" + userId;
    var sortId = "thingName_" + thingName;

    //manufacturerName
    //modelName
    //friendlyName
    //description
    

    var params = {
        Item: {
         "hashId": {
           S: hashId
          }, 
         "sortId": {
           S: sortId
          }
        }, 
        ReturnConsumedCapacity: "TOTAL", 
        TableName: deviceTableName
       };
    var response = await dynamodb.putItem(params).promise();
    console.log('PutItem response:\n' + JSON.stringify(response, null, 2));
}