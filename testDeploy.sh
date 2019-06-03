BUCKET=werberm-sandbox
#STACK_NAME=aws-alexa-smart-home-demo
STACK_NAME=test-smarthome-short4

sam package \
    --s3-bucket $BUCKET \
    --template-file testTemplate.yaml \
    --output-template-file testPackaged.yaml

sam deploy \
    --template-file testPackaged.yaml \
    --stack-name $STACK_NAME \
    --capabilities CAPABILITY_IAM
