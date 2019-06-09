# **Note: this is a work in process, not yet completed**

Some components are not yet functional and/or in early draft stage. 

# aws-alexa-smart-home-demo

Many of the existing Alexa Smart Home skill examples focus only on the Alexa skill's Lambda function and typically give hard-coded examples of JSON requests and responses between the AWS-managed Alexa service and your customer-managed Lambda function that acts as the 'brains' of your Alexa skill. 

This project aims to quickly give you a more realistic, end-to-end smart home skill example with the following core components: 

1. Real (developer user) sign-up via an Alexa-enabled smart speaker (e.g. an [Echo Dot](https://www.amazon.com/All-new-Echo-Dot-3rd-Gen/dp/B0792KTHKJ)), [Alexa web app](https://alexa.amazon.com), Alexa mobile app ( [Android](https://play.google.com/store/apps/details?id=com.amazon.dee.app&hl=en_US), [iOS](https://itunes.apple.com/us/app/amazon-alexa/id944011620?mt=8)), or the test tool from the [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask/). 

2. [An AWS IoT Core "Thing"](https://docs.aws.amazon.com/iot/latest/developerguide/iot-thing-management.html) that is a logical cloud representation of a physical smart home device. Your Alexa skill will send commands to or read device state from the IoT Thing. Your physical device will receive commands from or send device state updates to the IoT Thing. 

3. A [Cognito user pool](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html) that acts as the identity provider (IdP) for your skill and stores the credentials and attributes of your signed-up users. 

4. An [Amazon DynamoDB](https://aws.amazon.com/dynamodb/) table that contains a mapping between IoT Things and their Cognito user pool ID. 

5. A main [AWS Lambda](https://aws.amazon.com/lambda/) function that handles interaction between the AWS-managed Alexa service and your customer-managed AWS cloud backend resources listed above. 

6. OPTIONAL - An [ESP32](https://www.amazon.com/HiLetgo-ESP-WROOM-32-Development-Microcontroller-Integrated/dp/B0718T232Z) with some LEDs and temp/humidity sensor that is linked to your AWS IoT Thing. The LEDs react to commands you give to Alexa and the device sends temp & humidity readings back to the IoT Thing which Alexa can provide to a user upon request. 

## Prerequisites

1. AWS Account & admin user or role access
2. S3 Bucket (to store CloudFormation template)
3. [Node10.x](https://nodejs.org/en/download/) and [npm](https://www.npmjs.com/get-npm) (to install Lambda dependencies before uploading to AWS)

## Getting Started

1. Register a developer account with the [Alexa Developer Console](https://developer.amazon.com/). Note that the **email address** you use should match the email address you later plan to test your skill with. You could optionally complete additional steps to open up testing to others, but this demo does not cover that and focuses on testing by one user (you). 

2. Navigate to the [Alexa Skills Kit (ASK) Dashboard](https://developer.amazon.com/alexa/console/ask) and click **Create Skill**.

3. Give your skill a name, such as **alexa-smart-home-demo** and select **Smart Home** as the skill model. 

    ![name_alexa_skill]

    [name_alexa_skill]: ./images/name_alexa_skill.png

4. Click **Create Skill**. You will be taken to a configuration page. We need to first create additional resources before we use their values to complete this page. For now, copy your **Skill ID** (e.g. amzn1.ask.skill.xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) into a text editor. You will need this value later.

5. Navigate to [https://developer.amazon.com/settings/console/mycid](https://developer.amazon.com/settings/console/mycid) and copy your **Alexa Vendor ID** and **Customer ID** in a text editor along with your Skill ID. 

6. Your Alexa skill ID, vendor ID, and customer ID are needed to configure your skill's backend resources. As these are values are considered secrets and should not be shared, we will store them in [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/) and dynamically retrieve them when needed in order to keep them safe:

    1. Log in to your AWS account and navigate to the [AWS Secrets Manager Console](https://console.aws.amazon.com/secretsmanager/).
    2. Click **Store a new secret**.
    3. Under **Select secret type**, select **Other type of secret**.
    4. Specify three key value pairs with the key names of **SkillId**, **VendorId**, and **CustomerId** and with the values you copied earlier from the Alexa Developer Console. **Note:** key names are case sensitive and must match those shown below in order to work with the CloudFormation template we will launch later:

        ![create_secret_1]

        [create_secret_1]: ./images/create_secret_1.png

    5. Accept the default encryption key and click **Next**.

    6. For **Secret name**, use the value **AlexaSmartHomeSkillCredentials**. Use this exact value to avoid the need to change the CloudFormation template we will launch later. Optionally enter a brief **Description** and click **Next**:

        ![create_secret_2]

        [create_secret_2]: ./images/create_secret_2.png

    7. Accept the default value **Disable automatic rotation** and click **Next**.
    8. On the final review page, click **Store** to save your secret. 

2. 

3. (Install the SAM CLI)[https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html]. We use this CLI in our deployment script to create and launch a CloudFormation script containing the bulk of your needed resources. 


4. Edit **deploy.sh** and set the BUCKET variable to the name of an S3 bucket to use for storing later CloudFormation templates. 

    ```sh
    # deploy.sh
    BUCKET=your_bucket_name
    ```

5. Build and deploy the CloudFormation template by running deploy.sh from the project root:

    ```sh
    $ ./deploy.sh
    ```
