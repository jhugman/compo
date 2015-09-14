

let _ = require('underscore')

let EP = {
      ADDON_ID: 'internal.compo.addon.id',
      ADDON_LOADER: 'internal.compo.addon.loader',
      SINGLETONS: 'internal.compo.singletons',
    }

exports.AddonManager = class AddonManager {

  constructor (registry, cwd) {
    this._registry = registry
    this._rootDir = cwd || process.cwd()
    this._addons = {}
    this._addonIsLoading = {}

    let defaultLoader = require('./addon-loader')
    registry.register(EP.ADDON_LOADER, defaultLoader)
    
    this._loaders = registry.getExtensionPoint(EP.ADDON_LOADER)

    let ep = registry.getExtensionPoint(EP.ADDON_ID)
    ep.onAdd(this.load.bind(this))
    ep.onRemove(this.unload.bind(this))
  }

  get loader () {
    let all = this._loaders.array
    return all[all.length - 1];
  }

  load (pathOrId) {
    let loader = this.loader,
        base = loader.resolveAddon(this._rootDir, pathOrId),
        addon = this._addons[base]

    if (addon) {
      return Promise.resolve(addon)
    }

    if (this._addonIsLoading[base]) {
      // we should return a promise here, to allow multiple promise to 
      return;
    }
    this._addonIsLoading[base] = true

    let packageJson
    return loader.loadJsonFromModule(base, 'package.json')
      .then((json) => {
        packageJson = json
        addon = new Addon(base, packageJson.name)
        addon.api = new AddonAPI()
        let manifestFile = packageJson.compo
        if (manifestFile) {
          return loader.loadJsonFromModule(base, manifestFile)
        }
      })
      .then((manifest) => {
        let properties = {}
        if (manifest) {
          this._parseManifest(addon, manifest)
        }
        manifest = _.pick(packageJson, 'singletons', 'extensions', 'extensionPoints', 'permissions')
        this._parseManifest(addon, manifest)

        this._addons[base] = addon
        this._addonIsLoading[base] = false
        return addon.api
      })
  }


  _parseManifest (addon, manifest) {
    // manifest = manifests.normalize(manifest)
    let registry = this._registry
    let api = addon.api
    // `singletons` are objects that this addon defines
    // and made available to other addons as permissions
    {
      _.each(manifest.singletons, (i, id) => {
        let singleton = manifest.singletons[id]
        singleton._id = id
        registry.register(EP.SINGLETONS, singleton)
      })
    }

    // `permissions` is asking for access by this addon 
    {
      let ep = registry.getExtensionPoint(EP.SINGLETONS)
      ep.key = '_id'
      _.each(manifest.permissions, (p) => {
        Object.defineProperty(api, p, {
          get: function () {
            let obj = ep.object[p]
            if (obj) {
              return obj
            }
            throw new Error('Permission ' + p + ' is granted but no singleton of that name is registered')
          }
        })
      })
    }

    // `extensions`
    {
      _.each(manifest.extensions, (ex) => {
        let epID = ex.epID
        if (!epID) {
          console.warn('Addon ' + addon.name + ' has an extension with no epID')
        } else if (epID.indexOf('internal.') === 0) {
          console.warn('Addon ' + addon.name + ' has trying to contribute to a private extension point: ' + epID)
        } else {
          registry.register(ex.epID, ex)
        }
      })
    }
  }

  unload (pathOrId) {

  }
}

class Addon {
  constructor (base, name) {
    this.name = name
    this.location = base


  }


}

class AddonAPI {
  constructor () {
    _.extend(this, {
      _extensionPoints: {},
    })
  }
}