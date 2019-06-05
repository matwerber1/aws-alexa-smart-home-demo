const axios = require("axios");
const AWS = require('aws-sdk');
AWS.config.update({region:'us-east-1'});
var cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider();

async function main() {
    
    let response = await cognitoIdentityServiceProvider.deleteUserPoolDomain(
        {
            Domain: 'beetlejuice2',
            UserPoolId: 'us-east-1_LMdswy7sa'
        }
    ).promise();

    console.log(JSON.stringify(response.data, null, 2));
    return;
    console.log('Calling describeUserPoolDomain() with params:\n');
    var params = {
        Domain: 'sdfojdfodj' /* required */
      };
     response = await cognitoIdentityServiceProvider.describeUserPoolDomain(params).promise();
    console.log(JSON.stringify(response, null, 2));

    return;
    params = {
        UserPoolId: 'us-east-1_LMdswy7sa',
        Domain: 'beetlejuice2'
    };
    console.log('Calling createUserPoolDomain() with params:\n'
        + JSON.stringify(params, null, 2)
    );
    response = await cognitoIdentityServiceProvider.createUserPoolDomain(
        params
    ).promise();

    console.log(JSON.stringify(response, null, 2));

}

(async () => {
    try {
        var text = await main();
        console.log('Done!');
    } catch (e) {
        console.log(e);
    }
})();