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
                'OTHER', 
                'THERMOSTAT',
                'TEMPERATURE_SENSOR'
            ],
            validRange: {
                minimumValue: {
                    value: 60.0,
                    scale: "FAHRENHEIT"
                },
                maximumValue: {
                    value: 90.0,
                    scale: "FAHRENHEIT"
                }
            },
            capabilities: [
                {
                    // Basic capability that should be included for all
                    // Alexa Smart Home API discovery responses:
                    type: 'AlexaInterface',
                    interface: 'Alexa',
                    version: '3'
                },
                {
                    type: "AlexaInterface",
                    interface: "Alexa.EndpointHealth",
                    "version":"3",
                    properties: {
                        supported: [
                          {
                             name: "connectivity"
                          }
                       ],
                       retrievable: true
                    }
                },
                {
                    type: "AlexaInterface",
                    interface: "Alexa.TemperatureSensor",
                    version: "3",
                    properties: {
                        supported: [
                            {
                                "name": "temperature"
                            }
                        ],
                        retrievable: true
                    }
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