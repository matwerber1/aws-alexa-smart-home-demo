BUCKET=werberm-sandbox
STACK_NAME=aws-alexa-smart-home-demo
#STACK_NAME=tempest-alexa-demo

sam package \
    --s3-bucket $BUCKET \
    --template-file template.yaml \
    --output-template-file packaged.yaml

sam deploy \
    --template-file packaged.yaml \
    --stack-name $STACK_NAME \
    --capabilities CAPABILITY_IAM
