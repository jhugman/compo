let _ = require('underscore'),
    Registry = require('./lib/registry').Registry,
    PluginManager = require('./lib/plugin-manager').PluginManager

exports.createPluginManager = (rootDir) => {
  let registry = new Registry(),
      plugins = new PluginManager(registry, rootDir || process.cwd())
  
  plugins.load(__dirname)
    .catch((ex) => {
      console.log(ex.stack)
    })

  return plugins
}

// For testing purposes
exports.ExtensionPoint = require('./lib/extension-points').ExtensionPointAPI