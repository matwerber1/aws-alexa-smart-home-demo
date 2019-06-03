BUCKET=werberm-sandbox

sam package \
    --s3-bucket $BUCKET \
    --template-file template.yaml \
    --output-template-file packaged.yaml

sam deploy \
    --template-file packaged.yaml \
    --stack-name tempest-alexa-demo \
    --capabilities CAPABILITY_IAM
