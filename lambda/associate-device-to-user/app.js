var util = require("util");
var AWS = require("aws-sdk");
var dynamodb = new AWS.DynamoDB();

exports.handler = async (event) => {

    try {
        console.log(`Received event:\n${util.inspect(event)}`);
        await associateDeviceToUser(event.userId, event.thingName);
        const response = {
            statusCode: 200,
            message: `User ${event.userId} associated to thing ${event.thingName}`
        };
        return response;
    } catch (err) {
        console.log(`Error:\n${err}`);
        const response = {
            statusCode: 500,
            message: err
        };
        return response;
    }
};


async function associateDeviceToUser(userId, thingName) {

    var hashId = "userId_" + userId;
    var sortId = "thingName_" + thingName;
    var tableName = process.env.DEVICE_TABLE;

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
        TableName: tableName
       };
    var response = await dynamodb.putItem(params).promise();
    console.log('PutItem response:\n' + JSON.stringify(response, null, 2));
}