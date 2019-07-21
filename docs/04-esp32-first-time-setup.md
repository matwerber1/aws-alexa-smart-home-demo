# First-time Setup for ESP32

Before we dive into anything specific to this project, let's keep it simple and make sure you have basic connectivity to your ESP32 and can flash the Mongoose OS demo application: 

1. Follow steps 1 through 3 in the [Download and install the MOS tool] guide. 

2. As a test, also follow steps 4 through 7 in the MOS guide above to confirm you can successfully connect to and flash your ESP32.

    * Note - if using a Mac, some additional drivers / troubleshooting may be needed to things working. Pay careful attention to the guide. 

    * <mark>Important</mark> - After many hours of troubleshooting, I learned that not all USB cables are created equally :(. Some can only carry power to the ESP32, while others enable data connectivity. You will need the latter. [See this post](https://electronics.stackexchange.com/questions/140225/how-can-i-tell-charge-only-usb-cables-from-usb-data-cables) for additional information. 

3. If you've successfully flashed your ESP32 and confirmed its sending messages to the MOS console on your computer, you're ready to proceed!
