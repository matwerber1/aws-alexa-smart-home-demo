var util = require("util");
var AWS = require("aws-sdk");
var dynamodb = new AWS.DynamoDB();

exports.handler = async (event) => {
    // TODO implement
    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!'),
    };
    return response;
};
