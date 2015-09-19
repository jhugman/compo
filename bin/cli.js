let _ = require('underscore'),
    Registry = require('../lib/registry').Registry,
    AddonManager = require('../lib/addons-manager').AddonManager

let registry = new Registry(),
    plugins = new AddonManager(registry, process.cwd())

let pluginNames = _.clone(process.argv)
pluginNames.push('.')

let pluginsToLoad = _.chain(pluginNames)
  .filter((arg) => {
    return arg[0] !== '/'
  })
  .uniq()
  .map((pluginName) => {
    return plugins.load(pluginName)
      .catch((e) => {
        console.error(e.message)
        console.error(e.stack)
      })
  })
  .value()

Promise.all(pluginsToLoad)
  .then((plugin) => {
    // TODO plugin should have events available to it.
    //console.log('Loaded', plugin.name)
  })
  .catch((e) => {
    console.error(e.message)
    console.error(e.stack)
  })