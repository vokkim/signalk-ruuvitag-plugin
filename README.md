# Signal K Node server RuuviTag plugin

Signal K Node server plugin to provide [RuuviTag](https://tag.ruuvi.com/) environmental data:

- Temperature
- Humidity
- Pressure
- Acceleration X   (Ruuvi dataformat v5 only)
- Acceleration Y   (Ruuvi dataformat v5 only)
- Acceleration Z   (Ruuvi dataformat v5 only)
- Movement Counter (Ruuvi dataformat v5 only)

Also following sensor meta data is provided:

- RSSI (signal strength)
- Battery voltage (requires RuuviTag to run in [raw mode](https://lab.ruuvi.com/ruuvitag-fw/)
                   or Ruuvi dataformat v5)
- Data Format                 (Ruuvi dataformat v5 only)
- Measurement Sequence Number (Ruuvi dataformat v5 only)
- TX Power                    (Ruuvi dataformat v5 only)

### Usage

0. Running on linux: give `node` process permissions to scan BLE devices: ``sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)``
1. Install `signalk-ruuvitag-plugin` in Signal K Appstore and restart server
2. Open the `RuuviTag Plugin` config and activate plugin
3. Wait for few minutes and let the plugin to detect RuuviTag beacons
4. Reopen the `RuuviTag Plugin` config
5. Name your tags, set appropriate locations and enable Signal K data
6. Signal K values should now be transmitted to selected location, for example `environment.${location}.temperature`

![Plugin config](https://user-images.githubusercontent.com/1435910/35721120-472ff648-07f9-11e8-90e1-6e97a5a31ed8.png)


License
-------

MIT
