# **Note: this is a work in process, not yet completed**

Some components are not yet functional and/or in early draft stage. 

# aws-alexa-smart-home-demo

Many of the existing Alexa Smart Home skill examples focus only on the Alexa skill's Lambda function and typically give hard-coded examples of JSON requests and responses between the AWS-managed Alexa service and your customer-managed Lambda function that acts as the 'brains' of your Alexa skill. 

This project aims to quickly give you a more realistic, end-to-end smart home skill example with the following core components: 

1. Real (developer user) sign-up via an Alexa-enabled smart speaker (e.g. an [Echo Dot](https://www.amazon.com/All-new-Echo-Dot-3rd-Gen/dp/B0792KTHKJ)), [Alexa web app](https://alexa.amazon.com), Alexa mobile app ([Android](https://play.google.com/store/apps/details?id=com.amazon.dee.app&hl=en_US), [iOS](https://itunes.apple.com/us/app/amazon-alexa/id944011620?mt=8)), or the test tool from the [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask/). 

2. [An AWS IoT Core "Thing"](https://docs.aws.amazon.com/iot/latest/developerguide/iot-thing-management.html) that is a logical cloud representation of a physical smart home device. Your Alexa skill will send commands to or read device state from the IoT Thing. Your physical device will receive commands from or send device state updates to the IoT Thing. While an AWS IoT Core "thing" is not required, it greatly simplifies the interaction between the physical world and your backend services. In a production scenario, each physical device would be mapped to a unique IoT thing. 

3. A [Cognito user pool](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html) that acts as the identity provider (IdP) for your skill and stores the credentials and attributes of your signed-up users. 

4. An [Amazon DynamoDB](https://aws.amazon.com/dynamodb/) table that contains a mapping between IoT Things and their Cognito user pool ID. 

5. A main [AWS Lambda](https://aws.amazon.com/lambda/) function that handles interaction between the AWS-managed Alexa service and your customer-managed AWS cloud backend resources listed above. 

6. OPTIONAL - An [ESP32](https://www.amazon.com/HiLetgo-ESP-WROOM-32-Development-Microcontroller-Integrated/dp/B0718T232Z) with some LEDs and temp/humidity sensor that is linked to your AWS IoT Thing. The LEDs react to commands you give to Alexa and the device sends temp & humidity readings back to the IoT Thing which Alexa can provide to a user upon request. 

In addition to the core components above, a number of helper resources will be created via a CloudFormation template as part of the deployment steps outlined within this guide. 

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

7. Install the [SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html). The SAM CLI is provides several tools that make serverless app development on AWS easy, including the ability to locally test AWS Lambda functions. The specific functionality we will use is SAM's ability to translate and deploy short-hand SAM YAML templates into full-fledged CloudFormation templates. 

8. Add script or instructions for installing Node dependencies via npm in local folders before running the deploy.sh script. Without this step, the Lambda(s) that require external dependencies with fail when invoked with a "module not found" error on the `const some_package = require('package_name')` command. 

9. Edit **deploy.sh** and set the BUCKET variable to the name of an S3 bucket to use for storing later CloudFormation templates. It's recommend that you leave the **STACK_NAME=** parameter set to **alexa-smart-home-demo** as we will reference this stack name in later steps. 

    ```sh
    # deploy.sh
    BUCKET=your_bucket_name
    ```

10. Build and deploy the CloudFormation template by running deploy.sh from the project root:

    ```sh
    $ ./deploy.sh
    ```

11. Monitor the status of your stack from the [CloudFormation console](https://console.aws.amazon.com/cloudformation/) and wait for the status to show as **CREATE_COMPLETE**. 

12. From the CloudFormation console, click the **alexa-smart-home-demo** stack and then click the **Outputs** section. Here, you will see a number of values that we will plug in to your skill's configuration in the Alexa Developer Console to complete our skill setup. 

13. While keeping the CloudFormation console open, open the [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask/), click **Edit** next to the skill you created previously, and copy-paste (or enter) the following values:

    1. Click the **Smart Home** tab of the Alexa skill console, and: 

        1. Copy the value of the **AlexaDefaultEndpoint** output from CloudFormation into the **Default endpoint** box of the Alexa configuration:

        2. Cick **Save**

    2. Click the **Account Linking** tab of the Alexa skill console, and: 

        1. Copy the value of the **AlexaAuthorizationURI** output from CloudFormation into the **Authorization URI** box of the Alexa configuration.
        2. Copy the value of the **AlexaAccessTokenURI** output from CloudFormation into the **Access Token URI** box of the Alexa configuration.
        3. Copy the value of the **AlexaClientId** output from CloudFormation into the **Client ID** box of the Alexa configuration.
        4. Click the link in the value field of **AlexaClientSecret** in CloudFormation; you will be taken to a secret in AWS Secrets Manager; scroll down and click **Retrieve secret value** and copy the value of **clientSecret** from AWS Secrets Manager into the **Client Secret** box of the Alexa configuration. 
        5. Select **HTTP Basic (recommended)** as the **Client Authentication Scheme** in the Alexa configuration. 
        6. Add **phone** and **openid** as values to the **Scope** section of the Alexa Configuration. Note - spelling and case must exactly match. 
        7. Leave **Domain List** and **Default Access Token Expiration Time** blank. 
        8. Click Save:

## Optional - Hardware Setup

TODO: Document process for building the ESP32 mock thermostat and linking it to your AWS backend via AWS IoT Core. 

## Test your skill

At this point, your Alexa skill is properly linked to your backend Lambda function (for processing user directives) and your Cognito user pool (for user signup & authentication). You are now ready to sign up to test the skill with Alexa!

### Test via mobile app

1. Install the Amazon Alexa app ([Android](https://play.google.com/store/apps/details?id=com.amazon.dee.app&hl=en_US), [iOS](https://itunes.apple.com/us/app/amazon-alexa/id944011620?mt=8)) and sign in / register with the Alexa app using the same email address that you used to create your Alexa skill. 