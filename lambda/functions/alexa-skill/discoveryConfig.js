/* 
 Schema of discoveryConfig should be in the following format:  
    modelNumber:
        softwareVersion:
            <configuration>

The modelNumber and softwareVersion should match the values of the IoT Thing
attributes of the same name. 
*/

const discoveryConfig = {
    'smartThing-v1': {
        '1.00': {
            manufacturerName: 'SmartHome Products, Inc.',
            modelName: 'Model 001',
            friendlyName: 'Smart Device',
            description: 'My SmartHome Product!',
            displayCategories: [
                - 'OTHER'
            ],
            capabilities: [
                {
                    // Basic capability that should be included for all
                    // Alexa Smart Home API discovery responses:
                    type: 'AlexaInterface',
                    interface: 'Alexa',
                    version: '3'
                },
                {
                    type: 'AlexaInterface',
                    interface: 'Alexa.ThermostatController',
                    version: '3',
                    properties: {
                        supported: [
                            {
                                name: 'targetSetpoint'
                            },
                            {
                                name: 'thermostatMode'
                            },
                            {
                                name: 'targetSetpointDelta'
                            }
                        ],
                        retrievable: true
                    },
                    configuration: {
                        supportsScheduling: false, 
                        supportedModes: [
                            'HEAT',
                            'COOL',
                            'OFF'
                        ]
                    }
                }
            ]
        }
    } 
};

module.exports = discoveryConfig;