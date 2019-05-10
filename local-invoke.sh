#sam local invoke -e event.json

sam package --template-file template.yaml --s3-bucket werberm-sandbox --output-template-file packaged.yaml
sam deploy --template-file packaged.yaml --stack-name tempest-alexa-demo \
    --capabilities CAPABILITY_IAM