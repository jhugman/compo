const ADDON_EXTENION_POINT_ID = 'mozilla.plugins',
      ADDON_SECRET = 'doesnot matter'
      

let _ = require('underscore')

let loader = require('./plugin-loader'),
    loadPlugin = loader.loadPlugin,
    unloadPlugin = loader.unloadPlugin

let pluginsExtensionPoint
let registry
let extensionPoints 

class PluginsManager {

  constructor (extensionPoint) {
    pluginsExtensionPoint = extensionPoint

    function pluginWillLoad (plugin) {

    }

    function pluginDidUnload (plugin) {
      unloadPlugin(plugin, registry, extensionPoints)
    }

    extensionPoint.onAdd(pluginWillLoad)
    extensionPoint.onRemove(pluginDidUnload)
  }

  get registry () {
    return registry
  }

  // old - new = toUninstall
  // new - old = toInstall
  // [a, b, c] - [a, b, d] = [c]
  // [a, b, d] - [a, b, c] = [d]
  ensureInstalled (/*...*/uris) {
    let currentURIs = _.keys(installedPlugins)

    let toInstall = _.difference(uris, currentURIs)
    let toUninstall = _.difference(currentURIs, uris)

    toUninstall.forEach((uri) => {
      let plugin = installedPlugins[uri]
      if (plugin) {
        registry.unregister(ADDON_EXTENION_POINT_ID, plugin, ADDON_SECRET)
      }
    })

    return Promise.all(toInstall.map(this.load))
  }

  load (uri) {
    return loadPlugin(registry, extensionPoints, uri)
      .then((plugin) => {
        registry.register(ADDON_EXTENION_POINT_ID, plugin, ADDON_SECRET)
        return plugin
      })
  }

  unload (uri) {
    let installedPlugins = pluginsExtensionPoint.extensionsObjectView('manifestURI')
    let plugin = installedPlugins[uri]
    if (plugin) {
      registry.unregister(ADDON_EXTENION_POINT_ID, plugin, ADDON_SECRET)
    }
  }
}

exports.create = function create (opts) {
  registry = opts.registry
  extensionPoints = opts.extensionPoints

  let ep = extensionPoints(ADDON_EXTENION_POINT_ID)
  ep.grantAccess(ADDON_SECRET)

  return new PluginsManager(ep.api)
}