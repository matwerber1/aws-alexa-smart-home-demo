var AWS = require("aws-sdk");
var dynamodb = new AWS.DynamoDB.DocumentClient();

var deviceTableName = process.env.DEVICE_TABLE;

exports.handler = async (event) => {

    try {
        console.log(`Received event:\n${JSON.stringify(event)}`);
        await associateDeviceToUser(event);
        const response = {
            statusCode: 200,
            message: `User ${event.userId} associated to thing ${event.thingName}`
        };
        return response;
    } catch (error) {
        console.log(`Error:\n${error}`);
        throw error; 
    }
};


async function associateDeviceToUser(event) {

    var hashId = "userId_" + event.userId;
    var sortId = "thingName_" + event.thingName;

    var params = {
        Item: {
            hashId: hashId,
            sortId: sortId,
            userId: event.userId,
            thingName: event.thingName
        }, 
        ReturnConsumedCapacity: "TOTAL", 
        TableName: deviceTableName
       };
    var response = await dynamodb.put(params).promise();
    console.log('PutItem response:\n' + JSON.stringify(response, null, 2));
}