var AWS = require("aws-sdk");
var dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {

    try {
        console.log(`Received event:\n${JSON.stringify(event)}`);
        await createDeviceType(event);
        const response = {
            statusCode: 200,
            message: `Device type ${event.deviceType} created/updated.`
        };
        return response;
    } catch (error) {
        console.log(`Error:\n${error}`);
        throw error; 
    }
};


async function createDeviceType(event) {

    var hashId = "deviceType_" + event.deviceType;
    var sortId = "metadata";
    var tableName = process.env.DEVICE_TABLE;

    var params = {
        Item: {
            hashId: hashId,
            sortId: sortId,
            deviceType: event.deviceType,
            manufacturerName: event.manufacturerName,
            modelName: event.modelName,
            friendlyName: event.friendlyName,
            description: event.description,
            displayCategories: event.displayCategories,
            capabilities: event.capabilities
        }, 
        ReturnConsumedCapacity: "TOTAL", 
        TableName: tableName
    };
    var response = await dynamodb.put(params).promise();
    console.log('PutItem response:\n' + JSON.stringify(response, null, 2));
}