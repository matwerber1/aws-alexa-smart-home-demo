'use strict';

let data =  "eyJraWQiOiJVbSszRHY1bENkVDZsNWNHRE5QWUVkZVZpOU5qTWx2SzlRV0FXNVRFZURBPSIsImFsZyI6IlJTMjU2In0";
let buff = new Buffer(data, 'base64');  
let text = buff.toString('ascii');

console.log('"' + data + '" converted from Base64 to ASCII is "' + text + '"'); 