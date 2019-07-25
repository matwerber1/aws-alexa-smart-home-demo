load('api_aws.js');
load('api_config.js');
load('api_events.js');
load('api_gpio.js');
load('api_mqtt.js');
load('api_shadow.js');
load('api_timer.js');
load('api_sys.js');
load('api_dht.js');

let aws_thing_name = Cfg.get('aws.thing_name');

// A "last will and testament" (LWT) is configured by the device and instructs
// the AWS IoT Core pub/sub broker to send this message if the device disconnects.
// Without an LWT, if a device suddenly disconnected, it's shadow would incorrectly
// report { connectivity: "OK" } when it is not actually connected.
let last_will_message = JSON.stringify(
    {
        state: {
            reported: {
                connectivity: 'UNREACHABLE'
            }
        }
    }
);
let last_will_message_config = {
    mqtt: {
        will_message: last_will_message
    }
};
Cfg.set(last_will_message_config, true);

// If you do not specify a topic, Mongoose OS will publish the last will (LWT) to the
// reserved topic device shadow, as expected. However, currently, AWS IoT Core
// does not allow LWT messages to directly update a shadow. So instead, we have
// to publish to a custom topic and then set up a rule in IoT Core that forwards
// the message the actual reserved shadow topic. 
// https://docs.aws.amazon.com/iot/latest/developerguide/device-shadow-data-flow.html
let last_will_topic = 'alexaSmartHomeDemo/lastWill/' + aws_thing_name;
let last_will_topic_config = {
    mqtt: {
        will_topic: last_will_topic
    }
};
Cfg.set(last_will_topic_config, true);

// State that we will report back to AWS IoT
let reported_state = {
    deviceType: "AlexaSmartHomeDemo",
    connectivity: undefined,  
    uptime: 0,
    targetSetpoint: {
        scale: undefined,
        value: undefined
    },
    thermostatMode: "OFF",  // when device first boots up, set device mode to off. 
    temperature: {
        scale: undefined,
        value: undefined
    },
    ram_total: Sys.total_ram(),
};

// If we change state by physically interacting with the device, we need to 
// clear the desired state in IoT Core. Otherwise, as soon as we change reported
// state at the device, a difference between reported and desired will be sent
// to the device and the device will then revert back to desired (not what we want).
let desired_state = {};

// Pin numbers are specific to your board manufacturer & model number
//let red_led = 13;               // 5th pin from bottom left
//let blue_led = 5;               // 10th pin from bottom right
//let white_led = 17;             // 9th pin from bottom right
let blue_led = 25;              
let red_led = 33;              
let white_led = 32;           
let tempHumidityPin = 26;      
let button_pin = 27;

// Initialize DHT library for the temp / humidity sensor
let dht = DHT.create(tempHumidityPin, DHT.DHT11);

// Set initial output mode
GPIO.setup_output(red_led, 0);
GPIO.setup_output(blue_led, 0);
GPIO.setup_output(white_led, 0);

// Set LED pins to output mode
GPIO.set_mode(red_led, GPIO.MODE_OUTPUT);
GPIO.set_mode(blue_led, GPIO.MODE_OUTPUT);
GPIO.set_mode(white_led, GPIO.MODE_OUTPUT);
GPIO.set_mode(button_pin, GPIO.MODE_INPUT);

// Set LED to on or off
let setLED = function (led, state) {
    GPIO.write(led, state);
    print('LED ', led, ' on -> ', state);
};

// Only used if we change desired state by physically interacting with our device;
let publishDesiredState = function () {
    print('Published desired state changes...');
    let topic = '$aws/things/' + aws_thing_name + '/shadow/update';

    let message = JSON.stringify({
        state: {
            desired: desired_state
        }
    });

    print(topic, '->', message);
    MQTT.pub(topic, message, 0);
};

// Only used if we physically interact with device to change the thermostat mode;
let clearDesiredThermostatMode = function () {
    print('Current desired state: ', JSON.stringify(desired_state));
    desired_state.thermostatMode = null;
    print('Cleared thermostat mode from desired state: ', JSON.stringify(desired_state));
    publishDesiredState();
};

// Simulate changing the thermostat mode; in our case, we simply toggle LEDs
let setThermostatMode = function (mode) {

    print('Adjusting mode to ' + mode);
    if (mode === 'COOL') {
        setLED(blue_led, true);
        setLED(red_led, false);
    }
    else if (mode === 'HEAT') {
        setLED(blue_led, false);
        setLED(red_led, true);
    }
    else if (mode === 'OFF') {
        setLED(blue_led, false);
        setLED(red_led, false);
    }
    else {
        print('ERROR: unexpected mode ', mode, 'turning off device...');
        setLED(blue_led, false);
        setLED(red_led, false);
        mode = "OFF";
    }

    reported_state.thermostatMode = mode;
    
};

// When device first starts up, set mode to OFF:
setThermostatMode("OFF");

// Simulate changing the desired target temperature; 
let setTargetTemperature = function (newSetpoint) {

    print('Adjusting target temperature...');
    
    for (let key in newSetpoint) {
        reported_state.targetSetpoint[key] = newSetpoint[key];
    }
};

// report state back to AWS IoT Core
let reportState = function() {
  Shadow.update(0, reported_state);
};

//let tempMode = false;

// Update state every 2000 ms, and report to cloud if connected to AWS
Timer.set(2000, Timer.REPEAT, function () {

    /*
    setLED(blue_led, tempMode);
    setLED(red_led, tempMode);
    setLED(white_led, tempMode);
    tempMode = !(tempMode);
    */
    
    reported_state.uptime = Sys.uptime();
    reported_state.ram_free = Sys.free_ram();
    let temp_celsius = dht.getTemp();
    let humidity = dht.getHumidity();

    if (isNaN(humidity) || isNaN(temp_celsius)) {
        print('Failed to read data temp/humidity from sensor');
        reported_state.temperature.value = null;
        reported_state.temperature.scale = 'FAHRENHEIT';
        reported_state.humidity = null;
    }
    else {
        let temp_fahrenheit = (temp_celsius * (9 / 5)) + 32;
        reported_state.temperature.value = temp_fahrenheit;    
        reported_state.temperature.scale = 'FAHRENHEIT';
        reported_state.humidity = humidity;
    }
    if (reported_state.connectivity === "OK") {
        reportState();
    }

    print(JSON.stringify(reported_state));
    
}, null);

// Set up Shadow handler to synchronise device state with the shadow state
Shadow.addHandler(function (event, obj) {
    
    if (event === 'UPDATE_DELTA') {
        desired_state = obj;
        print('Received delta from shadow:', JSON.stringify(desired_state));
    
        for (let key in desired_state) {
      
            if (key === 'thermostatMode') {
                setThermostatMode(desired_state.thermostatMode);
            }
            if (key === 'targetSetpoint') {
                setTargetTemperature(desired_state.targetSetpoint);
            }

        }
    reportState();  // Report our new state, hopefully clearing delta
  }
});

let setConnectivity = function (isConnected) {

    if (isConnected === true) {
        print('Connected to AWS IoT Core!');
        reported_state.connectivity = "OK";
        setLED(white_led, true);
    }
    else {
        print('Disconnected from AWS IoT Core!');
        reported_state.connectivity = "UNREACHABLE";
        setLED(white_led, false);
    }
};

Event.on(Event.CLOUD_CONNECTED, function () {
    setConnectivity(true);
}, null);

Event.on(Event.CLOUD_DISCONNECTED, function() {
    setConnectivity(false);
}, null);


// this handler cycles the thermostat mode between OFF, ON, and COOL.
GPIO.set_button_handler(button_pin, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 50, function(x) {

    print("Thermostat button pressed on device!");
    let desired_mode = undefined;

    if (reported_state.thermostatMode === "OFF") {
        desired_mode = "COOL";
    }
    else if (reported_state.thermostatMode === "COOL") {
        desired_mode = "HEAT";
    }
    else if (reported_state.thermostatMode === "HEAT") {
        desired_mode = "OFF";
    }
        
    if (desired_mode !== undefined) {
        clearDesiredThermostatMode();
        setThermostatMode(desired_mode);
    }        
    else {
        print("Button press failed, unexpected current state: ", reported_state.thermostatMode);
    }

  }, true);