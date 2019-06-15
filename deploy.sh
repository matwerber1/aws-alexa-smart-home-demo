#!/bin/bash

# Install dependencies
#$(cd lambda/functions/cognito-verifyAuthToken && npm install)
#$(cd lambda/functions/cfProvider-uuid && npm install)

BUCKET=werberm-sandbox
STACK_NAME=alexa-smart-home-demo

sam package \
    --s3-bucket $BUCKET \
    --template-file template.yaml \
    --output-template-file packaged.yaml

sam deploy \
    --template-file packaged.yaml \
    --stack-name $STACK_NAME \
    --capabilities CAPABILITY_IAM
