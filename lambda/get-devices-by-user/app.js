var util = require("util");
var AWS = require("aws-sdk");
var dynamodb = new AWS.DynamoDB.DocumentClient();

var deviceTableName = process.env.DEVICE_TABLE;

exports.handler = async (event) => {
    
    await getDevicesByUser(event.userId);

};

async function getDevicesByUser(userId) {

    var params = {
        ExpressionAttributeValues: {
            ":hashId": 'userId_' + userId,        
            ":sortPrefix": 'thingName_'
        }, 
        KeyConditionExpression: "hashId = :hashId and begins_with(sortId, :sortPrefix)", 
        TableName: deviceTableName
    };
    var query_response = await dynamodb.query(params).promise();
    var userDeviceAssociations = query_response.Items;
    console.log('User device associations:\n' + JSON.stringify(userDeviceAssociations, null, 2));

    // Get a hash map which, initially, has a blank object for each unique
    // deviceType within our users' list of associated devices. We will make
    // subsequent calls to DDB to populate the metadata within the blank object
    // for each deviceType within this map. 
    var deviceTypeMap = getDeviceTypeMapFromUserDeviceAssociations(userDeviceAssociations);
    deviceTypeMap = await getDeviceTypeMapWithMetadata(deviceTypeMap);
    console.log('FInal deviceType Map:\n' + JSON.stringify(deviceTypeMap, null, 2));

}

function getDeviceTypeMapFromUserDeviceAssociations(userDeviceAssociations) {

    var deviceTypeMap = {};
    userDeviceAssociations.forEach(userDeviceAssociation => {
        var thingName = userDeviceAssociation.sortId;
        // IoT device's thingName should be in format thingName_XXXXX_YYYY, 
        // where XXXX is the deviceType and YYYY is the serial number. So, 
        // the split below should provide just the deviceType:
        var deviceType = thingName.split("_")[1];
        deviceTypeMap[deviceType] = {};
    });

    /* 
        returns a map = {
            tempest: {},
            tempestv2: {}
        }
    */
    return deviceTypeMap;
}

async function getDeviceTypeMapWithMetadata(deviceTypeMap) {

    /*
        deviceTypeMap = {
            tempest: {},
            tempest2: {}
        }
    */
    var requestKeys = [];
    for (var deviceTypeName in deviceTypeMap) {
        var requestKey = {
            hashId: 'deviceType_' + deviceTypeName, 
            sortId: 'metadata'
        }
        requestKeys.push(requestKey);
    }
    var requestItems = {};
    requestItems[deviceTableName] = {
        Keys: requestKeys
    }
    var params = {
        RequestItems: requestItems
    };
    console.log('Params are:\n' + JSON.stringify(params, null, 2));
    var batchGetResponse = await dynamodb.batchGet(params).promise();
    var metadataResponses = batchGetResponse.Responses[deviceTableName];
    /* metadataResponses = 
        [
            {
                "hashId": "deviceType_tempest",
                "manufacturerName": "Smarthome Products, Inc.",
                "description": "Super cool smart home product",
                "friendlyName": "Tempest Original",
                "modelName": "model 1",
                "sortId": "metadata"
            }
        ]
    */
    
    for (var index in metadataResponses) {
        var metadataResponse = metadataResponses[index];
        var deviceType = (metadataResponse.hashId).split("_")[1];
        console.log('Device type is ' + deviceType);
        deviceTypeMap[deviceType] = metadataResponse;
    }
    return deviceTypeMap;
}
