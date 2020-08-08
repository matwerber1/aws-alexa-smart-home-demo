#!/bin/bash

BUCKET=<your_bucket_name>
STACK_NAME=alexa-smart-home-demo

ALEXA_SKILL_ID=<your_alexa_skill_id>
ALEXA_VENDOR_ID=<your_alexa_vendor_id>

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
