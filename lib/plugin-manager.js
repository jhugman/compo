let _ = require('underscore'),
    path = require('path')

let constants = require('./constants'),
    EP = constants.EP,
    EP_CONFIG_DEFAULTS = constants.EP_CONFIG_DEFAULTS,
    PERMISSION_ACCESSOR_NAME = constants.PERMISSION_ACCESSOR_NAME

let Plugin = require('./plugins').Plugin

exports._Plugin = Plugin
exports.PluginManager = class PluginManager {

  constructor (registry, cwd) {
    this._registry = registry
    this._rootDir = cwd || process.cwd()
    this._pluginsByLocation = {}
    this._pluginsByName = {}
    this._pluginIsLoading = {}

    registry.register(EP.PLUGIN_LOADER, require('./plugin-loader'))
    
    this._id = 'pluginManager'
    this.description = 'The plugin manager running this show. You probably don\'t want this.'
    registry.register(EP.SINGLETONS, this)

    registry._id = 'extensionRegistry'
    registry.description = 'The extension registry gluing everything together. You probably don\'t want this.'
    registry.register(EP.SINGLETONS, registry)

    this._loaders = registry.getExtensionPoint(EP.PLUGIN_LOADER)
  }

  dispose () {
    let registry = this._registry
    register.unregister(EP.SINGLETONS, registry)
    register.unregister(EP.SINGLETONS, this)
    registry.unregister(EP.PLUGIN_LOADER, require('./plugin-loader'))
  }

  get loader () {
    let all = this._loaders.array
    return all[all.length - 1];
  }

  load (ids) {
    if (!_.isArray(ids)) {
      ids = _.toArray(arguments)
    }

    let loader = this.loader

    let createPlugin = (pathOrId) => {
      let base = loader.resolvePlugin(this._rootDir, pathOrId),
          plugin = this._pluginsByLocation[base]
      
      if (plugin) {
        return
      }

      if (this._pluginIsLoading[base]) {
        // we should return a promise here, to allow multiple promise to 
        return;
      }

      this._pluginIsLoading[base] = true
      return new Plugin(base)
    }

    let loadManifest = (plugins) => {
      return plugins.map((p) => {
        return p.intializeFromDisk(loader)
      });
    }

    let pluginsOnly = (plugins) => {
      return plugins.filter((p) => {
        return !!p._manifest
      })
    }

    let askForContributions = (plugins) => {
      let registry = this._registry
      plugins.forEach((p) => {
        this.transformManifest(p, p._manifest)
        p.provisionAPI(registry)
      })
      return plugins
    }

    let makeContributions = (plugins) => {
      plugins.forEach((p) => {
        return this.distributeExtensions(p)
      })
      return plugins
    }

    let returnPromise = (plugins) => {
      return plugins.map((p) => {
        let base = p.location
        this._pluginsByLocation[base] = p
        this._pluginsByName[p.name] = p
        this._pluginIsLoading[base] = false
        return p.api
      })
    }

    let pluginsToLoad = ids.map(createPlugin).filter((x) => x)

    return Promise.all(loadManifest(pluginsToLoad))
      .then(pluginsOnly)
      .then(askForContributions)
      .then(makeContributions)
      .then(returnPromise)
  }

  transformManifest (plugin, manifest) {
    let registry = this._registry
    let manifestTransforms = registry.getExtensionPoint(EP.MANIFEST_TRANSFORM).array

    manifestTransforms.forEach((t) => {
      // Should throw if manifest fails test
      t(manifest)
    })

    let extensionTransforms = registry.getExtensionPoint().objectGroups

    let performTransforms = (remaining) => {
      let addedExtensions = []
      let filtered = remaining.filter((ex) => {
        let remove = false
        let transforms = extensionTransforms[ex.epID]
        if (!transforms) {
          return true
        }
        transforms.forEach((t) => {
          t(ex, addedExtensions)
          if (t.replace) {
            replace = true
          }
        })
        return !replace
      })

      return filtered
    }
    
    let additions = manifest.extensions || []
    let extensions = []

    while (additions.length) {
      let newAdditions = []

      additions = performTransforms(additions, newAdditions)
      additions.forEach((ex) => {
        extensions.push(ex)
      })
      additions = newAdditions

    } 
  }

  distributeExtensions (plugin) {
    let registry = this._registry
    let manifest = plugin._manifest

    // `singletons` are objects that this plugin defines
    // and made available to other plugins as permissions
    /*
      {
        singletons: {
          prefs: './lib/app-writeable-files',
          samePrefs: {
            object: './lib/app-writeable-files'
          }
        }
      }
     */
    {
      let singletons = manifest.singletons
      if (_.isObject(singletons)) {
        _.each(manifest.singletons, (i, id) => {
          let singleton = manifest.singletons[id]
          singleton._id = id
          plugin.register(registry, EP.SINGLETONS, singleton)
        })
      }
    }

    // `extensions`: normalized to an array of objects, with the epID filled in.
    {
      _.each(manifest.extensions, (ex) => {
        let epID = ex.epID
        if (!epID) {
          console.warn('Plugin ' + plugin.name + ' has an extension with no epID')
        } else if (epID.indexOf('internal.') === 0) {
          console.warn('Plugin ' + plugin.name + ' has trying to contribute to a private extension point: ' + epID)
        } else {
          plugin.register(registry, ex.epID, ex)
        }
      })
    }
  }

  unload (nameOrLocation) {
    let plugin = this._pluginsByLocation[nameOrLocation] || this._pluginsByName[nameOrLocation]
    if (!plugin) {
      return Promise.reject(new Error('Plugin ' + nameOrLocation + ' not loaded'))
    }

    let p = plugin.unload(this._registry)

    delete this._pluginsByLocation[plugin.location]
    delete this._pluginsByName[plugin.name]

    return p
  }
}
