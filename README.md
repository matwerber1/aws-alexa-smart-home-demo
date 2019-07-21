# aws-alexa-smart-home-demo

## Overview
This project shows you how to build an Amazon Alexa skill to control a thermostat using the [Alexa Smart Home API](https://developer.amazon.com/docs/smarthome/understand-the-smart-home-skill-api.html).

* **You do not need a physical Alexa-enabled device** to build and test your skill. You can use the free [Alexa mobile app](https://www.amazon.com/gp/help/customer/display.html?nodeId=201602060) or [Alexa Web Console](https://alexa.amazon.com) sign up and beta test your skill. 

To model a basic thermostat, we will use a developer version of the popular [Espressif ESP32 microcontroller](https://www.espressif.com/en/products/hardware/esp32/overview), which contains built-in WiFi and Bluetooth modules for easy connectivity to the cloud. 

* **You do not need an ESP32 (or similar) device** if you do not want to build a physical (mock) thermostat. You can still build and test your Alexa skill without a physical device (though a real device is cooler!). 

## Architecture

At it's core, an Amazon Alexa skill is simply an [AWS Lambda function](https://aws.amazon.com/lambda/) that gets invoked by the AWS-managed Alexa service when a user speaks to their Alexa. You create a skill in the [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask) and then link it to a Lambda function in your AWS account, and your users register to use the skill via the Alexa mobile app or website. You need an OAuth identity provider (IdP) to keep track of your registered users, and for this demo we will use [Amazon Cognito](https://aws.amazon.com/cognito/).

[Custom Alexa Skills](https://developer.amazon.com/docs/custom-skills/understanding-custom-skills.html) essentially allow you to do anything you want when your Lambda function gets invoked. There are a number of [pre-made Alexa Skill Kits and APIs](https://developer.amazon.com/docs/ask-overviews/understanding-the-different-types-of-skills.html), like the [Smart Home Skill Kit](https://developer.amazon.com/docs/ask-overviews/understanding-the-different-types-of-skills.html#smart-home-skills-pre-built-model), that give you a framework for rapidly developing commonly-used Alexa skills. 

While you could build a smart home thermostat skill from scratch, we will use the Alexa Smart Home Skill Kit's [Thermostat Controller Interface](https://developer.amazon.com/docs/smarthome/build-smart-home-skills-for-hvac-devices.html) and [Temperature Sensor Interface](https://developer.amazon.com/docs/device-apis/alexa-temperaturesensor.html) to speed up the development process and remove a lot of guesswork. 

We will use [AWS IoT Core](https://aws.amazon.com/iot-core/) to create a `thing`, which is a logical representation of a physical device. Even if you do not build the optional ESP32 thermostat in this project, this project allows you to interact with your IoT `thing` as if it were a physical device.

We need to maintain a mapping between your skill's users (stored in Cognito) with their registered thermostats (stored in AWS IoT Core). There are number of places and ways this mapping could be stored, but for this project, we have opted to use [Amazon DynamoDB](https://aws.amazon.com/dynamodb/), a fully-managed NoSQL key-value database.

## Prerequisites

1. AWS Account with administrative access
2. A pre-existing Amazon S3 Bucket to store CloudFormation templates (or, you can create one as you go)
3. [Node10.x](https://nodejs.org/en/download/) and [npm](https://www.npmjs.com/get-npm) (to install Lambda dependencies before uploading to AWS)
4. Optional - an ESP32 and related components, if you want to build the physical "thermostat" - [ESP32 Bill of Materials / Parts List](docs/esp32-parts-list.md)

## Deployment

**Part 1 - Alexa Skill and AWS Cloud Backend [REQUIRED]:**

1. [Create Alexa Skill and AWS Backend](./docs/01-create-alexa-skill-and-aws-backend.md)
1. [Sign up for your skill](./docs/02-sign-up-for-your-skill.md)
1. [Test your skill](./docs/03-test-skill-without-device.md)

**Part 2 - Thermostat with ESP32 [OPTIONAL]:**

4. [ESP32 First-time Setup](./docs/04-esp32-first-time-setup.md)
5. [Build your ESP32 Thermostat](./docs/05-build-esp32-thermostat.md) (See [ESP32 parts list](./docs/05a-esp32-parts-list.md))
6. [Test your skill and thermostat](./docs/06-test-skill-with-esp32.md)

## Cost

On the AWS side of things, everything we do should cost near-zero (maybe pennies a month). I haven't calculated exact costs, but the [AWS Free Tier](https://aws.amazon.com/free/) covers a lot. As of this writing (July 2019), the "always free tier" provides more than enough usage to cover: 

* AWS Lambda (1 million invocations / month)
* Amazon Cognito (50,000 user pool actions / month)
* Amazon DynamoDB (25 GB of storage, 25 RCU & 25 WCUs equivalant to 200M requests per month)

The free tier also includes 12 months of free usage for certain services, including but not limited to: 

* AWS IoT (250K published or delivered messages per month)

Even if outside of the free tier usage, everything we are using will be pay-as-you-go based on actual usage, which should amount to mere pennies a month. That being said, remember you are responsible for watching your cost and usage. 
