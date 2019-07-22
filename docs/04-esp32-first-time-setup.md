# First-time Setup for ESP32

Before we dive into anything specific to this project, let's keep it simple and make sure you have basic connectivity to your ESP32 and can flash the Mongoose OS demo application: 

1. Follow steps 1 through 3 in the [Download and install the MOS tool](https://mongoose-os.com/docs/mongoose-os/quickstart/setup.md) guide. 

2. Before we do anything complicated, follow steps 4 through 7 in the [MOS tool guide](https://mongoose-os.com/docs/mongoose-os/quickstart/setup.md) above to confirm you can successfully connect to and flash your ESP32.

3. If you've successfully flashed your ESP32 and confirmed its sending messages to the MOS console on your computer, you're ready to proceed!

## Troubleshooting

**Note** - if using a Mac, some additional drivers / troubleshooting may be needed to things working. Pay careful attention to the guide. 

**Note** - After many hours of troubleshooting, I learned that not all USB cables are created equally :(. Some can only carry power to the ESP32, while others enable data connectivity. You will need the latter. [See this post](https://electronics.stackexchange.com/questions/140225/how-can-i-tell-charge-only-usb-cables-from-usb-data-cables) for additional information. 


## Next Ste ps

Proceed to [Step 5 - Build Your ESP32 Thermostat](./05-build-esp32-thermostat.md).