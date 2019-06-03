# aws-alexa-smart-home-demo

## Prerequisites

1. Read/Write access to an existing S3 bucket, to store CloudFormation templates.
2. ESP32 
3. breadboard and jumper wires
4. Three LEDs of different color (preferably red, white, blue)
3. One DSP11 temperature/humidity sensor
4. Resistors: three of X ohms, one of Y ohms
5. Mobile phone with Amazon Alexa app installed
6. OPTIONAL - Alexa-enabled smart speaker (e.g. Echo, Echo Dot, Echo Show, etc.)

## Getting Started

1. Register (or sign-in) to the [Alexa Developer Console](https://developer.amazon.com/).

2. Navigate to the [Alexa Skills Kit (ASK) Dashboard](https://developer.amazon.com/alexa/console/ask) and click **Create Skill**.

3. Give your skill a name, such as **smart-home-demo** and select **Smart Home** as the skill model: 

    ![name_alexa_skill]

[name_alexa_skill]: ./images/name_alexa_skill.png


4. Edit **deploy.sh** and set the BUCKET variable to the name of an S3 bucket to use for storing later CloudFormation templates. 

    ```sh
    # deploy.sh
    BUCKET=your_bucket_name
    ```

5. Build and deploy the CloudFormation template by running deploy.sh from the project root:

    ```sh
    $ ./deploy.sh
    ```

## AWS IoT

An AWS IoT thing exists as a logical representation of each physical device.
Each thing's name and other attributes/configuration are below:

| Property | Value| Comments |
|----------|------|----------|
| **Thing Name** | deviceType_XXXX | **XXXX** is the device's serial number. | 

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