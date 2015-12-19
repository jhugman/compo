// Remain here for backward compat reasons.
let _ = require('underscore'),
    path = require('path'),
    cwd = process.cwd(),
    compo = require('..'),
    plugins = compo.createPluginManager(cwd),
    compoPlugin = compo.plugin

let pluginNames = _.clone(process.argv)

try {
  let cwdModule = require(path.join(cwd, 'package.json'))
  let devDependencies = Object.keys(cwdModule.devDependencies || {})
  devDependencies.forEach((p) => {
    pluginNames.push(p)
  })  
} catch (e) {
  console.error('compo must be started in an npm module', e.stack)
  return
}

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