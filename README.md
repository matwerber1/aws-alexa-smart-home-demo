# aws-alexa-smart-home-demo

**Forgive the mess, this is a work in process, far from complete. Not yet ready to deploy!**

**THIS README, THE COMMENTS/DOCS/ETC ARE NOT COMPLETE / CORRECT (YET)!**

The current Alexa skill documentation provides solid Alexa API documentation and
example Lambda functions with hard-coded JSON input events and responses, but 
they do not provide a full, 'end-to-end' dynamic project. 

The goal of this project is to provide a fast, easy way to deploy an end-to-end
solution that includes these key features: 

1. Alexa Skill created in the Alexa Developer Console [developer.amazon.com/alexa/console/ask](developer.amazon.com/alexa/console/ask)
2. Cognito User Pool configured as the identity provider (IdP) for the Alexa skill
3. An AWS IoT Core "Thing" created in the IoT Registry
4. DynamoDB table to store a mapping of IoT Things associated to our Cognito users
5. Lambda linked to our Alexa skill that handles all core Alexa logic, such as: 
    * Querying DynamoDB to discover devices available to our user
    * Taking user input from Alexa and updating the IoT Thing's device shadow
    * Querying device state from IoT thing's device shadow and returning to Alexa
6. OPTIONAL - Guide to link AWS IoT Thing's device shadow to LEDs on an ESP32 board

This project assumes that you manually associate an IoT Thing to a skill user
by adding a record to the application's DynamoDB table; a mockup of the user-device
registration process is not included. 

## Prerequisites

1. AWS Account
2. IAM user access with admin privileges
3. S3 Bucket to store project files


### OPTIONAL - Hardware

This project includes an optional hardware setup that includes an ESP32 chip with LEDs and a temp/humidity sensor. Though not required, you may link this device to your AWS IoT and Alexa backend for a more realistic Smart Home experience. 

1. Read/Write access to an existing S3 bucket, to store CloudFormation templates.
2. ESP32 
3. breadboard and jumper wires
4. Three LEDs of different color (preferably red, white, blue)
3. One DSP11 temperature/humidity sensor
4. Resistors: three of X ohms, one of Y ohms
5. Mobile phone with Amazon Alexa app installed
6. OPTIONAL - Alexa-enabled smart speaker (e.g. Echo, Echo Dot, Echo Show, etc.)

## Getting Started

1. Register a developer account with the [Alexa Developer Console](https://developer.amazon.com/).

2. Install and initialize the Alexa CLI, following **steps 1 to 3** in the [Alexa CLI quick start documentation](https://developer.amazon.com/docs/smapi/quick-start-alexa-skills-kit-command-line-interface.html).

    * **Note:** When you run `ask init` on step 3, choose **No** when asked **"do you want to host your skill's backend code in AWS Lambda?"**. Choosing 'yes' is needed if you want the Alexa service to host your Lambda functions... however, this special hosting option is not available for the Smart Home skills kit. We will instead be hosting Lambda functions (and other AWS resources) in *your* AWS account, which is why we can say "no" to the ASK CLI.

3. (Install the SAM CLI)[https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html]

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
