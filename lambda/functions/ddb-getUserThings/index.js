const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();

const DEVICE_TABLE_NAME = process.env.DEVICE_TABLE;

exports.handler = async (event, context) => {

    try {
        console.log(`Received event:\n${JSON.stringify(event)}`);
        var deviceList = await getDevicesByUser(event.userId);
        const response = {
            deviceList: deviceList
        };
        return response;
    } catch (error) {
        console.log(`Error:\n${error}`);
        throw error; 
    }
};

async function getDevicesByUser(userId) {

    // First, get the IoT Thing Names associated to our user.
    var params = {
        ExpressionAttributeValues: {
            ":hashId": 'userId_' + userId,        
            ":sortPrefix": 'thingName_'
        }, 
        //ProjectionAttributes: "hashId, sortId",
        KeyConditionExpression: "hashId = :hashId and begins_with(sortId, :sortPrefix)", 
        TableName: DEVICE_TABLE_NAME
    };
    var query_response = await dynamodb.query(params).promise();
    var userDeviceAssociations = query_response.Items;
    console.log('User devices associations:\n' + JSON.stringify(userDeviceAssociations, null, 2));

    // Each device name has the device type as part of the name. We parse out
    // a list of unique device types from the list of device names into an 
    // object map, below. Initially, each key in the object is a deviceType
    // equal to {}. By having a unique list of device types, we can do a single
    // BatchGetItem() call to DDB to get all of the device type metadata at once.
    // If we instead looped through each device once at a time to call DDB
    // for the corresponding metadata, we would instead make multiple calls
    // and potentially call to get the same metadata twice. 
    var deviceTypeList = getDeviceTypeListFromUserDeviceAssociations(userDeviceAssociations);
    console.log("Device type list:\n" + JSON.stringify(deviceTypeList, null, 2));

    // Now that we have the list of device types, we will query DDB for each
    // device type's metadata and then use that to populate our object map:
    var deviceTypeMetadata = await getDeviceTypeMetadata(deviceTypeList);
    console.log('deviceTypeMetadata:\n' + JSON.stringify(deviceTypeMetadata, null, 2));

    // Combine the device associations with the metadata to get our final device list:
    for (i in userDeviceAssociations) {
        var deviceType = userDeviceAssociations[i].thingType;
        console.log(`i=${i} and deviceType=${deviceType}`);
        console.log('Data to merge: ' + JSON.stringify(deviceTypeMetadata[deviceType], null, 2));
        Object.assign(userDeviceAssociations[i], deviceTypeMetadata[deviceType]);
        
    }
    console.log('Updated user device associations:\n' + JSON.stringify(userDeviceAssociations, null, 2));

    return userDeviceAssociations;
}

function getDeviceTypeListFromUserDeviceAssociations(userDeviceAssociations) {

    var deviceTypeSet = new Set();
    userDeviceAssociations.forEach(userDeviceAssociation => {
        deviceTypeSet.add(userDeviceAssociation.thingType);
    });
    return Array.from(deviceTypeSet);
}

async function getDeviceTypeMetadata(deviceTypeList) {
    
    /*
        deviceTypeList = ['type1', 'type2', ...]
    */
    
    var deviceTypeMetadata = {};
    
    if (deviceTypeList.length === 0) {
        return deviceTypeMetadata;
    } else {
        var requestKeys = [];
        for (index in deviceTypeList) {
            var deviceTypeName = deviceTypeList[index];
            var requestKey = {
                hashId: 'deviceType_' + deviceTypeName, 
                sortId: 'metadata'
            }
            requestKeys.push(requestKey);
        }
        var requestItems = {};
        requestItems[DEVICE_TABLE_NAME] = {
            Keys: requestKeys
        }
        var params = {
            RequestItems: requestItems
        };
        console.log('BatchGet params are:\n' + JSON.stringify(params, null, 2));
        var batchGetResponse = await dynamodb.batchGet(params).promise();
        var metadataResponses = batchGetResponse.Responses[DEVICE_TABLE_NAME];

        for (var index in metadataResponses) {
            var metadata = metadataResponses[index];
            deviceTypeMetadata[metadata.deviceType] = metadata;
        }
        return deviceTypeMetadata;
    }
}

function isEmpty(obj) {
    for(var key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}