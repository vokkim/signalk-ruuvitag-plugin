const _ = require('lodash')
const Bacon = require('baconjs')

module.exports = function(app) {

  let config = {}
  let unsubscribes = []
  let ruuviInitialized = false
  let ruuviTagsProperty = undefined

  const start = (initialConfig) => {
    config = _.cloneDeep(initialConfig)

    if (!ruuviInitialized) {
      ruuviTagsProperty = initializeRuuviListener()
      ruuviInitialized = true
    }

    const unsubConfig = ruuviTagsProperty.onValue(tags => {
      _.each(tags, ({id, dataStream}) => {
        if (!config[id]) {
            config[id] = {
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
        app.handleMessage('ruuvitag', createDelta(data))
      }
    })

    unsubscribes = [unsubData, unsubConfig]
  }

  const stop = () => {
    _.each(unsubscribes, fn => fn())
    unsubscribes = []
  }

  const schema = () => {
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
}

  return {
    id: 'ruuvitag',
    name: 'RuuviTag Plugin',
    description: 'Provides environment data from nearby RuuviTags beacons.',
    schema,
    start,
    stop
  }
}

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
    humidity: data.humidity,
    pressure: data.pressure,
    temperature: data.temperature,
    accelerationX: data.accelerationX,
    accelerationY: data.accelerationY,
    accelerationZ: data.accelerationZ,
    rssi: data.rssi,
    raw: !data.eddystoneId
  }
}

const performUnitConversions = (data) => {
  data.humidity = data.humidity / 100 // 38% -> 0.38
  data.temperature = data.temperature + 273.15 // C -> K
  if (!data.raw) {
    data.pressure = data.pressure * 100  // hPa -> Pa
  }
  return data
}

const createDelta = (data) => ({
  updates: [
    {
      'source': 'ruuvitag.' + data.name,
      values: [
        {
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
      ]
    }
  ]
})