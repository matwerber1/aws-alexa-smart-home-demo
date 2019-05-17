var util = require("util");
var AWS = require("aws-sdk");
var dynamodb = new AWS.DynamoDB();

exports.handler = async (event) => {

    try {
        console.log(`Received event:\n${JSON.stringify(event)}`);
        await createDeviceType(event.deviceType);
        const response = {
            statusCode: 200,
            message: `Device type ${event.deviceType.name} created/updated.`
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


async function createDeviceType(deviceType) {

    var hashId = "deviceType_" + deviceType.name;
    var sortId = "metadata";
    var tableName = process.env.DEVICE_TABLE;

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

    deviceAttributes = deviceType.attributes;

    for (var key in deviceAttributes) {
        // skip loop if the property is from prototype
        if (!deviceAttributes.hasOwnProperty(key)) continue;
        var deviceAttributeName = key; 
        var deviceAttribute = deviceAttributes[key];
        var attributeProps = {}
        attributeProps[deviceAttribute.type] = deviceAttribute.value;
        params.Item[deviceAttributeName] = attributeProps;
    }

    var response = await dynamodb.putItem(params).promise();
    console.log('PutItem response:\n' + JSON.stringify(response, null, 2));
}