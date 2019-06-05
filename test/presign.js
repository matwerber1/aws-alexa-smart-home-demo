const AWS = require('aws-sdk');
const axios = require("axios");
const url = require("url");
var s3 = new AWS.S3();
var params = {};



async function main() {
    var params = {Bucket: 'werberm-sandbox', Key: 'testSignedPut'};
    var signedUrl = s3.getSignedUrl('putObject', params);
    console.log(`URL is: ${signedUrl}`);
    
    var parsedUrl = url.parse(signedUrl);
    console.log('Parsed URL: ' + parsedUrl);
    
    var responseBody = {
        Status: "SUCCESS",
        Reason: "See the details in CloudWatch Log Stream: 2019/06/03/[$LATEST]4ff3a05fa52342c3b306649027f65653",
        PhysicalResourceId: "test-smarthome-short3-UserPoolClientSecret-CCIQL3MMJ5IV",
        StackId: "arn:aws:cloudformation:us-east-1:544941453660:stack/test-smarthome-short3/016eaf50-861f-11e9-b2fb-0eb08bdb4cec",
        RequestId: "9845d418-350c-44c5-80de-774ca8a1ce72",
        LogicalResourceId: "UserPoolClientSecret",
        Data: {
            SecretArn: "arn:aws:secretsmanager:us-east-1:544941453660:secret:test-smarthome-short3-UserPoolClientSecret-CCIQL3MMJ5IV-nw1hX8",
            SecretName: "test-smarthome-short3-UserPoolClientSecret-CCIQL3MMJ5IV"
        }
    };

    var responseBodyStringified = JSON.stringify(responseBody);

    var options = {
        method: 'put',
        headers: {
            "Content-type": "",
            "content-length": responseBodyStringified.length
        },
        data: responseBodyStringified
    };
    console.log('Awaiting axios...')
    //response = await axios(options);
    response = await axios(signedUrl, options);
    console.log("STATUS: " + response.status);
    console.log("HEADERS: " + JSON.stringify(response.headers, null, 2));

}

(async () => {
    try {
        var text = await main();
        console.log('Done!');
    } catch (e) {
        console.log(e);
    }
})();