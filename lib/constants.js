let EP = {
      PLUGIN_ID: 'internal.compo.plugin.id',
      PLUGIN_LOADER: 'internal.compo.plugin.loader',
      SINGLETONS: 'internal.compo.singletons',
      MANIFEST_TRANSFORM: 'compo.manifest.transform',
      EXTENSION_TRANSFORM: 'compo.extension.transform',
    }

let EP_CONFIG_DEFAULTS = {
  key: '_id', // how the array is transformed into an object
  lazy: false, // is code loaded lazily or eagerly
  stringIs: 'object', // if the extension is just a string, what then?
  description: null, // should be something there, right?
}

const PERMISSION_ACCESSOR_NAME = 'plugin'

module.exports = {
  EP,
  EP_CONFIG_DEFAULTS,
  PERMISSION_ACCESSOR_NAME,
}