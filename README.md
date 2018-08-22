# Signal K Node server RuuviTag plugin

Signal K Node server plugin to provide [RuuviTag](https://tag.ruuvi.com/) environmental data:

- Temperature
- Humidity
- Preassure

Also following sensor meta data is provided:

- RSSI (signal strength)
- Battery voltage (requires RuuviTag to run in [raw mode](https://lab.ruuvi.com/ruuvitag-fw/))

### Usage

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