# **Note: this is a work in process, not yet completed**

Some components are not yet functional and/or in early draft stage. 

# aws-alexa-smart-home-demo

## Smart Home Background

Before we begin with this Alexa Smart Home-focused demo, let's understand the basic smart home interaction model. We'll do so by working backwards from your customer's experience. 

It all starts with your customer buying your smart home device, bringing it home, plugging it in or putting in batteries, and turning it on. 

From there, your customer may interact locally with the device in a number of ways, including but not limited to: buttons, switches, visual queues, verbal commands, bluetooth, infrared, or wifi.

But what makes the device a "smart home device"? Definitions vary, and we won't get caught up in semantics... but this author argues that it's typically something in the home that supports your customer's daily activities, is easy to interact with, and has internet connectivity that enables things such as information exchange, interaction with other remote devices, remote monitoring, and/or remote control.

## Alexa and Smart Home Devices

[Alexa](https://developer.amazon.com/alexa) is Amazon's cloud-based voice service available on over 100 million devices from Amazon and third-party device manufacturers. With Alexa, you can build natural voice experiences that offer customers a more intuitive way to interact with their smart home devices that they use every day.

There are two ways you can use Alexa to add intuitive voice experiences to your smart home device: 

1. **Alexa Built-in** - you build the Alexa Voice Service (AVS) into your product; your users talk to your product directly, i.e. your are responsible for embedding the Alexa software into your device and building hardware that includes (or can plug into) a microphone and speakers. 

2. **Alexa Skill** - you build an *Alexa Skill* which your customer then registers with one of their *existing* Alexa-enabled devices (e.g. Echo, FireTV, Alexa mobile app, etc.). Your customer speaks to their existing Alexa device to activate your skill, and your skill then interacts with your smart device via the internet.

This project provides a demo of the **Alexa Skill** model, which works in the following way: 

1. Your user issues a command to their Alexa-enabled device (e.g. an Amazon Echo)
2. The Alexa device forwards the command to the Amazon-managed Alexa Cloud.
3. The Alexa cloud analyzes the command to determine the user's intent; once it determines the intent, it forwards the intent as a command to an AWS Lambda function within the device manufacturer's AWS Account. 
4. The AWS Lambda function performs whatever task(s) the device manufacturer specifies via code; examples include but are not limited to: ordering products, playing music, finding and returning information, reading state of remote devices, or sending commands to remote devices. 

Alexa Skills may either be developed as [custom skills](https://developer.amazon.com/docs/custom-skills/understanding-custom-skills.html) or built using one of several [Alexa Skill Kits](https://developer.amazon.com/en-US/alexa/alexa-skills-kit). In both cases, the Alexa Cloud sends and receives responses from an AWS Lambda function built by and housed within the manufacturer's private AWS account. 

The difference is that the skill kits provide pre-defined request/response models for common use cases and handle much of the heavy lifting that the manufacturer would ordinarily need to code in a custom skill. Example skill kits include but are not limited to kits for smart home, video, music, and flash briefing skills. 

This project provides a demo of the [Alexa Smart Home Skill Kit API](https://developer.amazon.com/docs/smarthome/understand-the-smart-home-skill-api.html). 

## Alexa Smart Home Skill Workflow

A basic workflow might look like this: 

1. Customer purchases a smart home device
2. Customer registers the smart home device with manufacturer's backend cloud service; registration typically occurs using a web or mobile app provided by the manufacturer (*not* the Alexa web or mobile app)
3. Customer registers Alexa Smart Home skill with their existing Alexa-enabled device using the Alexa mobile or web app
4. Customer tells Alexa to "discover devices"
5. Alexa Cloud invokes Lambda function in manufacturer's AWS account
7. Manufacturer's Lambda function looks up device(s) registered to the customer (from Step 2) and returns list of registered devices to Alexa Cloud
6. Alexa Cloud now knows which smart home devices are available for interaction and shows those devices in the customer's Alexa mobile or web app (or speaks them via voice)
7. Customer issues voice commands to Alexa to control their registered smart home device
8. Alexa Cloud forwards command to manufacturer's Lambda function
9. Manufacturer's Lambda function sends commands or gather's information to the smart home device; exact logic of how this occurs is responsibility of the manufacturer.
10. Manufacturer's Lambda function sends a response to Alexa Cloud service indicating whether the command was successful or not
11. Alexa Cloud forwards response to customer's Alexa device
12. Customer's Alexa device voices response to the customer

In the above workflow, the customer uses an Alexa-enabled device for voice interaction with their smart home device. However, the customer is free to also use the Alexa web or mobile app to accomplish the same results.

It's also worth noting that the Alexa device or Alexa web/mobile app are not the only way to interact with the smart home device. The manufacturer is free to develop their own web, mobile, or other means of interacting with the device. 

## Project Overview

Many of the existing Alexa Smart Home skill examples focus only on the Alexa skill's Lambda function and give hard-coded examples of JSON requests and responses between the Amazon-managed Alexa Cloud service and the device manufacturer's AWS Lambda function.

This project aims to quickly give a more realistic, end-to-end smart home skill example with the following core components: 

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

### Create Alexa Skill and Backend Cloud Infrastructure

First, we create our Alexa Smart Home Skill in the Amazon-managed Alexa Cloud and our smart home application infrastructure in our AWS account. We connect the two components by giving the Alexa Cloud permission to invoke a Lambda function within our AWS account and by giving the Lambda function permission to send responses to our skill in the Alexa Cloud:

1. Register a developer account with the [Alexa Developer Console](https://developer.amazon.com/). Note that the **email address** you use should match the email address you later plan to test your skill with. You could optionally complete additional steps to open up testing to others, but this demo does not cover that and focuses on testing by one user (you). 

2. Navigate to the [Alexa Skills Kit (ASK) Dashboard](https://developer.amazon.com/alexa/console/ask) and click **Create Skill**.

3. Give your skill a name, such as **alexa-smart-home-demo** and select **Smart Home** as the skill model. 

    ![name_alexa_skill]

    [name_alexa_skill]: ./images/name_alexa_skill.png

4. Click **Create Skill**. You will be taken to a configuration page. We need to first create additional resources before we use their values to complete this page. For now, copy your **Skill ID** (e.g. amzn1.ask.skill.xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) into a text editor. You will need this value later.

5. Navigate to [https://developer.amazon.com/settings/console/mycid](https://developer.amazon.com/settings/console/mycid) and copy your **Alexa Vendor ID** into your text editor, along with your Skill ID. 

6. Open **deploy.sh** and enter your Alexa skill ID and vendor ID into their corresponding variables. Note, these values are considered secrets so you would not normally commit these to source in a production environment; you may want to instead want to manage them with a secrets manager like AWS Secrets Manager:

    ```sh
    # deploy.sh
    ALEXA_SKILL_ID=amzn1.ask.skill.1bb2f0b3-1234-1234-1234-1234ea6b04b3
    ALEXA_VENDOR_ID=1234N12341234
    ```

7. Edit **deploy.sh** and set the BUCKET variable to the name of an S3 bucket to use for storing later CloudFormation templates. It's recommend that you leave the **STACK_NAME=** parameter set to **alexa-smart-home-demo** as we will reference this stack name in later steps. 

    ```sh
    # deploy.sh
    BUCKET=your_bucket_name
    ```

8. Install the [SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html). The SAM CLI is provides several tools that make serverless app development on AWS easy, including the ability to locally test AWS Lambda functions. The specific functionality we will use is SAM's ability to translate and deploy short-hand SAM YAML templates into full-fledged CloudFormation templates. 

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
        8. Click Save.

### Sign up for your skill

Now that our skill and backend cloud infrastructure exists, we can now sign up to use the skill:

1. Install the Amazon Alexa app ([Android](https://play.google.com/store/apps/details?id=com.amazon.dee.app&hl=en_US), [iOS](https://itunes.apple.com/us/app/amazon-alexa/id944011620?mt=8)) and sign in **using the same email address** that you used to create your Alexa skill. Alternatively, you may follow the [Alexa Beta Tester Guide](https://developer.amazon.com/docs/custom-skills/skills-beta-testing-for-alexa-skills.html) to invite others to use your skill.

2. Open the Alexa app and click **Devices** in the lower right:

    <img src="./images/register-1.PNG" width="25%" border="1">

3. Click **Your Smart Home Skills** in the middle of the screen:

    <img src="./images/register-2.PNG" width="25%" border="1">

4. You should see a skill named **alexa-smart-home-demo** (or, whatever name you used when creating your skill in the Alexa Developer Console). If you do not see your skill, ensure that you are signed in to the Alexa app using the same email you used in the Alexa Developer Console or using an email that you sent a beta invitation to. Click the skill name: 

    <img src="./images/register-3.PNG" width="25%" border="1">

5. Click **Enable to use**:

    <img src="./images/register-4.PNG" width="25%" border="1">

6. You will be brought to a sign-in screen. Click **sign up**:

    <img src="./images/register-5.PNG" width="25%" border="1">

7. Sign up for your skill with your mobile number (for US numbers, must be in the format "+1xxxyyyzzzz"):

    <img src="./images/register-6.PNG" width="25%" border="1">

8. You will receive a verification code via SMS text. Enter that code to complete the sign-up process:

    <img src="./images/register-7.PNG" width="25%" border="1">

9. You should be greeted with a **successfully linked** message. Close the window to start the device discovery process:

    <img src="./images/register-8.PNG" width="25%" border="1">

10. Click **Discover Devices** to have the Alexa Cloud invoke your skill's Lambda function to search for and tell Alexa which device(s) are registered to your account: 

    <img src="./images/register-9.PNG" width="25%" border="1">