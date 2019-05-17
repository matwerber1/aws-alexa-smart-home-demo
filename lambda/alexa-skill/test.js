var AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });
var lambda = new AWS.Lambda();

async function main() {

    var expected = '{ "userId" : "4b8224a1-5fd5-44cb-95f2-db1a2d89b2fb" }'

    var payload = {
        userId: '4b8224a1-5fd5-44cb-95f2-db1a2d89b2fb'
    };

    var actual = JSON.stringify(payload);

    console.log('Expected:\n' + expected + '\n');
    console.log('Actual:\n' + actual)

    var params = {
        FunctionName: 'tempest-alexa-demo-GetDevicesByUserFunction-1G6UXLDSEFENS',
        InvocationType: "RequestResponse",
        Payload: actual
    };
    console.log('Calling Lambda...');
    getUserDevicesResponse = await lambda.invoke(params).promise();
    console.log('Lambda response:\n' + JSON.stringify(getUserDevicesResponse,null,2));
}

(async () => {
    try {
        var text = await main();
        console.log('Done!');
    } catch (e) {
        console.log(e);
    }
})();