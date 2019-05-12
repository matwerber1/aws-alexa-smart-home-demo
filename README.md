# aws-tempest-alexa-demo

## AWS IoT

An AWS IoT thing exists as a logical representation of each physical device.
Each thing's thing name in IoT Core should be in the format **deviceType_serialNumber**.

## Amazon DynamoDB

Our key application data is stored in a DynamoDB **device table**. The device table has several different data sets (e.g. user-to-device mappings or device type metadata) and different prefixes in the table's **hashId** and **sortId** attributes can be used to identify data set types. 

### Device Type Metadata

Within the **device table**, each device type has a single item that stores device type metadata such as **manufacturerName**. The metadata record is identified by the following **hashId** and **sortId**:

| hashId          | sortId   | Comments                        |
|-----------------|----------|---------------------------------|
| **deviceType_XXXX** | **metadata** | **XXXX** is the device type's name. |

### User to Device Association

Within the **device table**, each user has one item for each device that is associated to the user's account. a user may have zero or more devices associated to their account. For each association, the user is identified by the **hashId** and the device is identified by the **sortId**:

| hashId          | sortId   | Comments                        |
|-----------------|----------|---------------------------------|
| **userId_XXXX** | **thingName_YYYY** | **XXXX** is the user's subId (i.e. UID) in their Amazon Cognito User Pool and **YYYY** is the device's name which should exactly match the device's thing name in IoT Core. |