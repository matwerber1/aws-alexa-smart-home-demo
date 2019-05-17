    var util = require("util");
    var AWS = require("aws-sdk");
    var dynamodb = new AWS.DynamoDB.DocumentClient();

    var DEVICE_TABLE_NAME = process.env.DEVICE_TABLE;

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
        // equal to {}.
        var deviceTypeMap = getDeviceTypeMapFromUserDeviceAssociations(userDeviceAssociations);
        console.log("Device type map:\n" + JSON.stringify(deviceTypeMap, null, 2));

        // Now that we have the list of device types, we will query DDB for each
        // device type's metadata and then use that to populate our object map:
        deviceTypeMap = await getDeviceTypeMapWithMetadata(deviceTypeMap);
        console.log('DeviceType map with attributes:\n' + JSON.stringify(deviceTypeMap, null, 2));

        return deviceTypeMap;
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
        
        if (isEmpty(deviceTypeMap)) {
            return {};
        } else {
            var requestKeys = [];
            for (var deviceTypeName in deviceTypeMap) {
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
            console.log('Params are:\n' + JSON.stringify(params, null, 2));
            var batchGetResponse = await dynamodb.batchGet(params).promise();
            var metadataResponses = batchGetResponse.Responses[DEVICE_TABLE_NAME];
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
                deviceTypeMap[deviceType] = metadataResponse;
            }
            return deviceTypeMap;
        }
    }

function isEmpty(obj) {
    for(var key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}