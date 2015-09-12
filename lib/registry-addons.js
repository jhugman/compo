const ADDON_EXTENION_POINT_ID = 'mozilla.addons',
      ADDON_SECRET = 'doesnot matter'
      

let _ = require('underscore')

let loader = require('./addon-loader'),
    loadAddon = loader.loadAddon,
    unloadAddon = loader.unloadAddon

let addonsExtensionPoint
let registry
let extensionPoints 

class AddonsManager {

  constructor (extensionPoint) {
    addonsExtensionPoint = extensionPoint

    function addonWillLoad (addon) {

    }

    function addonDidUnload (addon) {
      unloadAddon(addon, registry, extensionPoints)
    }

    extensionPoint.onAdd(addonWillLoad)
    extensionPoint.onRemove(addonDidUnload)
  }

  get registry () {
    return registry
  }

  // old - new = toUninstall
  // new - old = toInstall
  // [a, b, c] - [a, b, d] = [c]
  // [a, b, d] - [a, b, c] = [d]
  ensureInstalled (/*...*/uris) {
    let currentURIs = _.keys(installedAddons)

    let toInstall = _.difference(uris, currentURIs)
    let toUninstall = _.difference(currentURIs, uris)

    toUninstall.forEach((uri) => {
      let addon = installedAddons[uri]
      if (addon) {
        registry.unregister(ADDON_EXTENION_POINT_ID, addon, ADDON_SECRET)
      }
    })

    return Promise.all(toInstall.map(this.load))
  }

  load (uri) {
    return loadAddon(registry, extensionPoints, uri)
      .then((addon) => {
        registry.register(ADDON_EXTENION_POINT_ID, addon, ADDON_SECRET)
        return addon
      })
  }

  unload (uri) {
    let installedAddons = addonsExtensionPoint.extensionsObjectView('manifestURI')
    let addon = installedAddons[uri]
    if (addon) {
      registry.unregister(ADDON_EXTENION_POINT_ID, addon, ADDON_SECRET)
    }
  }
}

exports.create = function create (opts) {
  registry = opts.registry
  extensionPoints = opts.extensionPoints

  let ep = extensionPoints(ADDON_EXTENION_POINT_ID)
  ep.grantAccess(ADDON_SECRET)

  return new AddonsManager(ep.api)
}