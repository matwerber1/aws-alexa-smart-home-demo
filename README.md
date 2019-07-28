# aws-alexa-smart-home-demo

## Overview
This project shows you how to build an Amazon Alexa skill to control a thermostat using the [Alexa Smart Home API](https://developer.amazon.com/docs/smarthome/understand-the-smart-home-skill-api.html).

Whereas many Alexa examples focus only on the AWS Lambda function and dummy JSON responses sent to/from the Alexa service, this project aims to give a more complete end-to-end demo by demonstrating ways that one might use Amazon DynamoDB, AWS IoT Core, Amazon Cognito, and other services. 

A picture is worth a thousand words: 

<img src="./images/architecture-overview.JPG" border="1" style="border-color: black;transform:rotate(180deg);">

## No Physical Devices Necessary

* **You do not need a physical Alexa device** to interact with your skill or control your thermostat. You can use the free [Alexa mobile app](https://www.amazon.com/gp/help/customer/display.html?nodeId=201602060) or [Alexa Web Console](https://alexa.amazon.com) sign up and beta test your skill. 

* **You do not need an ESP32** if you do not want to bother creating a physical device. Your Alexa skill can interact purely with the AWS IoT device shadow, and you can place dummy data into the shadow to simulate the device being online. That being said, the project is way more fun if you build the ESP32 mock thermostat, too :)

## Demo Video

This video shows the ESP32 in action by asking Alexa to change the device's state and asking it for the current temperature: 
https://www.youtube.com/watch?v=Cc9Y0D2bzJ8

## Work in process

Most of the project is done.... but there are still gaps in documentation and instructions. Please bear with me as I clean this up.

## Disclaimer

This is my first dive into AWS IoT + an Alexa skill. There are no doubt ways to do things better; some of my design choices may not be ideal. For example:

* Should I just be using IoT thing attributes to store a mapping of thing to user instead of DynamoDB?
* Is storing device configuration (e.g. capabilities) for discovery in a Lambda config file the right place to do it? 

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

## Architecture Overview

At it's core, an Amazon Alexa skill is simply an [AWS Lambda function](https://aws.amazon.com/lambda/) that gets invoked by the AWS-managed Alexa service when a user speaks to their Alexa. You create a skill in the [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask) and then link it to a Lambda function in your AWS account, and your users register to use the skill via the Alexa mobile app or website. You need an OAuth identity provider (IdP) to keep track of your registered users, and for this demo we will use [Amazon Cognito](https://aws.amazon.com/cognito/).

[Custom Alexa Skills](https://developer.amazon.com/docs/custom-skills/understanding-custom-skills.html) essentially allow you to do anything you want when your Lambda function gets invoked. There are a number of [pre-made Alexa Skill Kits and APIs](https://developer.amazon.com/docs/ask-overviews/understanding-the-different-types-of-skills.html), like the [Smart Home Skill Kit](https://developer.amazon.com/docs/ask-overviews/understanding-the-different-types-of-skills.html#smart-home-skills-pre-built-model), that give you a framework for rapidly developing commonly-used Alexa skills. 

While you could build a smart home thermostat skill from scratch, we will use the Alexa Smart Home Skill Kit's [Thermostat Controller Interface](https://developer.amazon.com/docs/smarthome/build-smart-home-skills-for-hvac-devices.html) and [Temperature Sensor Interface](https://developer.amazon.com/docs/device-apis/alexa-temperaturesensor.html) to speed up the development process and remove a lot of guesswork. 

We will use [AWS IoT Core](https://aws.amazon.com/iot-core/) to create a `thing`, which is a logical representation of a physical device. Even if you do not build the optional ESP32 thermostat in this project, this project allows you to interact with your IoT `thing` as if it were a physical device.

A core component of our project is the IoT thing's [device shadow](https://docs.aws.amazon.com/iot/latest/developerguide/iot-device-shadows.html), which is a JSON document managed by the AWS IoT Shadow Service that keeps track of the current device state, aka `reported state`, sent by our physical device (if used), and the `desired state` which we can change in the cloud manually, via an application, or - in this case - via interaction with Alexa. The shadow is a powerful feature that allows us to 'queue' messages or commands for our device when connectivity is lost. If our device is disconnected and we change the desired state in the shadow such that it doesn't match the last known reported state, the shadow service will notify the device of the difference between reported and desired state as soon as the device reestablishes a connection to the cloud. With a device shadow, we can decouple the remote control of our device with need for internet connectivity. 

We need to maintain a mapping between your skill's users (stored in Cognito) with their registered thermostats (stored in AWS IoT Core). There are number of places and ways this mapping could be stored, but for this project, we have opted to use [Amazon DynamoDB](https://aws.amazon.com/dynamodb/), a fully-managed NoSQL key-value database.


### Questionable Design Decisions

This section contains design choices that I am unsure of or where I want to further explain my reasoning. 

#### DynamoDB to store user-to-device mappings

I chose DynamoDB because I wanted the possibility of a "many to one" mapping of users to a single device. For example, maybe a household (family or roommates) all want to control the same thermostat using their separately-registered Alexa devices and accounts. If we only needed a "one-to-one" mapping, then it would be simpler to use an attribute in our IoT thing's device registry. 

#### Storing Alexa discovery config in Lambda code
 
 When a user asks Alexa to discover available devices, Alexa will query your backend application (via a Lambda) to ask for a list of devices associated to the user's Cognito ID. You must return a [Discovery response](https://developer.amazon.com/docs/device-apis/alexa-discovery.html#response) in the form of a list for each device containing basic information (e.g. device name, manufacturer name) as well as complex nested structures that describe the device's capabilities (e.g. [ThermostatController](https://developer.amazon.com/docs/device-apis/alexa-thermostatcontroller.html)). 

While the simple attributes could be stored as attributes in the AWS IoT Registry, the registry didn't seem like a good fit for the complex structures that describe device capabilities/interfaces. So, I opted to contain both the simple and complex information in a Javascript map object as part of the Alexa Lambda's source code (`./lambda/functions/alexa-skill/discoveryConfig.js`). 
    
The config object has the following format:

```javascript
const discoveryConfig = {
    'smartThing-v1': {
        '1.00': {
            manufacturerName: 'SmartHome Products, Inc.',
            modelName: 'Model 001',
            friendlyName: 'Smart Device',
            description: 'My SmartHome Product!',
            displayCategories: [
                'OTHER', 
                'THERMOSTAT',
                'TEMPERATURE_SENSOR'
            ],
            capabilities: [
                {
                    type: "AlexaInterface",
                    interface: "Alexa.EndpointHealth",
                    "version":"3",
                    properties: {
                        supported: [
                            {
                                name: "connectivity"
                            }
                        ],
                        retrievable: true
                    }
                },
                ...
            ]
        }
    }
```

The first key, `smartThing-v1` is the physical device's model number, while the second key, `1.00`, is the device's version. The keys within that represent the device's basic attributes and Smart Home capabilities. My thought was that both the physical device (model number) and its firmware version both dictate what capabilities it has, so that's how I opted to organize configuration. 

As I revisit this logic, I **do** like the idea of keeping the complex nested structures for things like capabilities as part of the Alexa skill's source code, as these (should) be static for a given model and firmware version and generally only need to be retrieved by the Alexa Lambda. 

However, I imagine that in a production scenario, you could have the same model number and firmware version built by multiple manufacturers, so it feels wrong to include this as a static attribute. I think it would be better to move this to either an attribute on a per-thing basis in the IoT device registry or to a separate data store like DynamoDB. 

#### Modifying Shadow's Desired State from the Physical Device

Most of the literature I read calls for two de-facto rules:
1. Physical device should only modify `reported` state and **never** modify `desired` state in the device shadow. 
2. Cloud should only modify `desired` state and never modify `reported` state; only the device knows what `reported` state is. 

I agree with #2, but ran into challenges with this demo that could only be solved by breaking rule #1. 

First, for this project, my functional requirements are such that:
1. The thermostat should be controllable by both cloud-side and physical button on device
2. The user's physical interaction with the thermostat should always overrule desired state (if any) previously set by the cloud

The challenge I ran in to was this: 
1. Hypothetically, say a user previously asked Alexa to set mode to COOL; Alexa (via Lambda) set `desired` state to `COOL`, the thermostat received a shadow delta via MQTT, and accordingly changed the mode to COOL and sent a `reported` state value of `COOL` back to the shadow. Desired and reported state match, we are at peace. 
2. User walks up to the thermostat and presses a button to change the mode to `HEAT`. The device correctly changes the physical mode and then sends a shadow update of `reported = HEAT`. 
3. AWS IoT Shadow Service now sees a delta in state, because `reported = HEAT` but `desired = COOL` (from previous Step 1)
4. Shadow Service sends a shadow delta message to the thermostat (desired = COOL)
5. Thermostat sees that desired state is COOL, changes physical state to COOL, and sends a shadow update of `reported = COOL`.
6. Again, reported and desired state are in harmony and equal COOL, but our user wants the mode to be HEAT. 

The only way I could solve for the problem above was to have the physical ESP32 thermostat clear the `desired` state when the user physically interacts to change the mode (i.e. pushes the mode button).

I think the **theory** behind my solution is correct, but the actual implementation is faulty as I didn't account for scenarios where, for example, the device is disconnected from the internet and the user presses a button. In such a case, the command to "clear" the desired state would be dropped and when the device re-connects, we would again run into the same problem. Perhaps incorporating timestamps into state requests make sense... e.g. if a delta is old (because of previously-lost connectivity), ignore it and clear desired state? Or, if a device was disconnected and the user physically changed its state, compare the timestamp of the physical state change with the timestamp of the desired state change and let the latest timestamp win? 

I suppose it depends on your specific use case and who/when/where/how disputes should be resolved. For ecample, if your business use case was such that "orders from the cloud should always override user's physical interaction with the device', then this would be a non-issue. For normal retail and consumer smart home applications, I imagine user interaction should always take precedent. For commercial, industrial, and other large-scale use cases, perhaps cloud should always take precedent? 

Would love to hear thoughts from anyone that has production experience with this type of scenario. 

## User Stories

I've created the [Appendix - User Stories](./docs/appendix-user-stories.md) to document my (basic) understanding of the stories that a Smart Home Company, device manufacturer, and end-user might follow.

## Cost

On the AWS side of things, everything we do should cost near-zero (maybe pennies a month). I haven't calculated exact costs, but the [AWS Free Tier](https://aws.amazon.com/free/) covers a lot. As of this writing (July 2019), the "always free tier" provides more than enough usage to cover: 

* AWS Lambda (1 million invocations / month)
* Amazon Cognito (50,000 user pool actions / month)
* Amazon DynamoDB (25 GB of storage, 25 RCU & 25 WCUs equivalant to 200M requests per month)

The free tier also includes 12 months of free usage for certain services, including but not limited to: 

* AWS IoT (250K published or delivered messages per month)

Even if outside of the free tier usage, everything we are using will be pay-as-you-go based on actual usage, which should amount to mere pennies a month. That being said, remember you are responsible for watching your cost and usage. 
