REGION=us-east-1

aws --region $REGION iot create-keys-and-certificate \
    --set-as-active \
    --certificate-pem-outfile=fs/cert.pem \
    --public-key-outfile=fs/public.pem    \
    --private-key-outfile=fs/private.pem