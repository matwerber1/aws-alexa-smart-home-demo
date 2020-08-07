#!/bin/bash

BUCKET=<your_bucket_name>
STACK_NAME=alexa-smart-home-demo

ALEXA_SKILL_ID=amzn1.ask.skill.427f703f-4494-4c5a-90b3-7095119accc8
ALEXA_VENDOR_ID=M1HA2HEQHZ2O67

# Install Lambda function dependencies
sam build

sam package \
    --s3-bucket $BUCKET \
    --template-file .aws-sam/build/template.yaml \
    --output-template-file packaged.yaml

sam deploy \
    --template-file packaged.yaml \
    --stack-name $STACK_NAME \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides AlexaSkillId=$ALEXA_SKILL_ID AlexaVendorId=$ALEXA_VENDOR_ID
