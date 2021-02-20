'use strict';
const PLUGIN_ID   = 'signalk-ruuvitag'
const PLUGIN_NAME = 'RuuviTag Plugin (supports dataformat v5)'

const debug = require('debug')(PLUGIN_ID);
const _     = require('lodash')
const Bacon = require('baconjs')

module.exports = function(app) {

  let plugin = {};
  plugin.id = PLUGIN_ID;
  plugin.name = PLUGIN_NAME;
  plugin.description = 'Provides environment data from nearby RuuviTag beacons.';
  let config = {}
  let unsubscribes = []
  let ruuviInitialized = false
  let ruuviTagsProperty = undefined

  plugin.start = function (initialConfig, restartPlugin) {
    app.debug('Plugin started');
    config = _.cloneDeep(initialConfig)

    if (!ruuviInitialized) {
      ruuviTagsProperty = initializeRuuviListener()
      ruuviInitialized = true
    }

    const unsubConfig = ruuviTagsProperty.onValue(tags => {
      _.each(tags, ({id, dataStream}) => {
        if (!config[id]) {
            config[id] = {       // seem to be defaults 
              id: id,
              name: id.substring(0, 6),
              location: 'inside',
              enabled: false
            }
          }
      })
    })

    const allTagsDataStream = ruuviTagsProperty.flatMapLatest(tags => {
      const dataStreams = _.map(tags, ({id, dataStream}) => {
        return dataStream
          .skip(1)
          .map(data => createRuuviData(config, id, data))
          .map(data => performUnitConversions(data))
      })
      return Bacon.mergeAll(dataStreams)
    })

    const unsubData = allTagsDataStream.onValue(data => {
      if (data.enabled) {
        app.handleMessage(PLUGIN_ID, createDelta(data))
      }
    })

    unsubscribes = [unsubData, unsubConfig]
  } // end plugin.start

  plugin.stop = function () {
      app.debug('Plugin stopped');
    _.each(unsubscribes, fn => fn())
    unsubscribes = []
  } // end plugin.stop

  plugin.schema = function() {
    app.debug('Plugin schema');

    // iterate through all found RuuviTags and construct schema object
    const properties = _.mapValues(config, (c, id) => ({
      title: `Tag ${id}`,
      type: 'object',
      properties: {
        enabled: {
          title: 'Enabled. Receive data and emit Signal K values',
          type: 'boolean',
          default: false
        },
        name: {
          title: 'Source name',
          minLength: 1,
          maxLength: 12,
          description: 'Length: 1-12, Valid characters: (a-z, A-Z, 0-9)',
          type: 'string',
          pattern: '^[a-zA-Z0-9]*$',
          default: id.substring(0, 6)
        },
        location: {
          title: 'Location',
          description: 'Tag location',
          type: 'string',
          enum: ['inside', 'outside', 'inside.refrigerator', 'inside.freezer', 'inside.heating', 'inside.engineRoom', 'inside.mainCabin'],
          default: 'inside'
        }
      }
    }))
    return {
      title: "",
      type: "object",
      properties
    }
  } // end plugin.schema

  return plugin;
} // end module.exports

const initializeRuuviListener = () => {
  const ruuvi = require('node-ruuvitag')

  return Bacon.fromEvent(ruuvi, 'found')
    .map(tag => {
      const dataStream = Bacon.fromEvent(tag, 'updated')
      const id = tag.id
      return {id, dataStream}
    })
    .scan([], (acc, value) => acc.concat([value]))
}

const createRuuviData = (config, id, data) => {
  return {
    id: id,
    name: _.get(config, [id, 'name'], id.substring(0, 6)),
    enabled: _.get(config, [id, 'enabled'], false),
    location: _.get(config, [id, 'location'], 'inside'),
    dataFormat: data.dataFormat,            // better include this info, too. Helps to identify invalid data
    movementCounter: data.movementCounter,  // v5
    measurementSequenceNumber: data.measurementSequenceNumber, // v5
    humidity: data.humidity,
    pressure: data.pressure,
    temperature: data.temperature,
    accelerationX: data.accelerationX,
    accelerationY: data.accelerationY,
    accelerationZ: data.accelerationZ,
    rssi: data.rssi,
    txPower: data.txPower,
    battery: data.battery,
    raw: !data.eddystoneId
  }
}

const performUnitConversions = (data) => {
    if ( data.dataFormat == 5 ) {
	// let's round all values after any conversions
	// to 1 digit more than the ruuvi's numerical resolution
	if (data.temperature != null) {
	    data.temperature = _.round(data.temperature + 273.15, 4); // C -> K
	}
	if (data.humidity != null ) {
	    data.humidity = _.round(data.humidity / 100, 7); // 38% -> 0.38
	}
	// if (data.pressure != null) {
	    //data.pressure = _.round(data.pressure, 1); // Pa
	// }
	if (data.accelerationX != null ) {
	    data.accelerationX = _.round(data.accelerationX / 1000, 4); // mG -> G
	}
	if (data.accelerationY != null ) {
	    data.accelerationY = _.round(data.accelerationY / 1000, 4); // mG -> G
	}
	if (data.accelerationZ != null ) {
	    data.accelerationZ = _.round(data.accelerationZ / 1000, 4); // mG -> G
	}
	if (data.battery != null) {
	    data.battery = _.round(data.battery / 1000, 4); // mV -> V
	}
	// txPower
	// movementCounter
	// measurementSequenceNumber
    }
    else if ( data.dataFormat < 5 ) { // legacy formats
	data.humidity = data.humidity / 100 // 38% -> 0.38
	data.temperature = data.temperature + 273.15 // C -> K
	data.battery = data.battery / 1000  // mV -> V
	if (!data.raw) {
	    data.pressure = data.pressure * 100  // hPa -> Pa
	}
    }
    else {  // data format not (yet) supported
	// now what ?
    }
  return data
}

const createDelta = (data) => {
    if (data.dataFormat == 5 ) return {
	// pathes were chosen to match SignalK's definition so that the correct unit
	// is displayed in the webinterface of the SignalK Server (->databrowser)
	//
	// test1 - path not recognized with correct unit by SignalK
	//			path: `environment.${data.location}.${data.name}.relativeHumidity`,
	// test2 - also no correct unit displayed
	//                      path: `environment.${data.location}.${data.name}.electrical.batteries.internal.voltage`,
	// test3 - this doesn't seem to work
	//                      meta: { "units": "V",
	//                              "description": "Voltage of Ruuvitag's internal battery" }
	// test4 - not yet implemented in SignalK?
	//			path: `sensors.${data.name}.dataFormat`,
	// test5 - this shows the voltage as 'Volts', but it is a different path from all the other ruuvitag data
	//                      path: `electrical.batteries.${data.name}.voltage`,
	updates: [
	    {
		source: { label: 'ruuvitag-currently-ignored-label',
			  src: data.name },
		values: [
		    {
			path: `environment.${data.location}.dataFormat`,
			value: data.dataFormat
		    },
		    {
			label: `Humidity ${data.location}`,
			path: `environment.${data.location}.relativeHumidity`,
			value: data.humidity
		    },
		    {
			path: `environment.${data.location}.temperature`,
			value: data.temperature
		    },
		    {
			path: `environment.${data.location}.pressure`,
			value: data.pressure
		    },
		    {
			path: `environment.${data.location}.rssi`,
			value: data.rssi
		    },
		    {
			path: `environment.${data.location}.battery`,
			value: data.battery,
		    },
		    {
			path: `environment.${data.location}.accelerationX`,
			value: data.accelerationX,
		    },
		    {
			path: `environment.${data.location}.accelerationY`,
			value: data.accelerationY,
		    },
		    {
			path: `environment.${data.location}.accelerationZ`,
			value: data.accelerationZ,
		    },
		    {
			path: `environment.${data.location}.txPower`,
			value: data.txPower,
		    },
		    {
			path: `environment.${data.location}.movementCounter`,
			value: data.movementCounter,
		    },
		    {
			path: `environment.${data.location}.measurementSequenceNumber`,
			value: data.measurementSequenceNumber,
		    },
		]
	    }
	]
    }
    else return {
	updates: [
	    {
		source: { label: 'ruuvitag-currently-ignored-label',
			  src: data.name  },
		values: [
		    {
			label: `Data Format ${data.location}`,
			path: `environment.${data.location}.dataFormat`,
			value: data.dataFormat
		    },
		    {
			label: `Humidity ${data.location}`,
			path: `environment.${data.location}.humidity`,
			value: _.round(data.humidity, 2)
		    },
		    {
			path: `environment.${data.location}.temperature`,
			value: _.round(data.temperature, 2)
		    },
		    {
			path: `environment.${data.location}.pressure`,
			value: _.round(data.pressure)
		    },
		    {
			path: `environment.${data.location}.rssi`,
			value: _.round(data.rssi)
		    },
		    {
			path: `environment.${data.location}.battery`,
			value: _.round(data.battery)
		    },
		]
	    }
	]
    }
}
