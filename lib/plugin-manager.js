let _ = require('underscore'),
    path = require('path')

let constants = require('./constants'),
    EP = constants.EP

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

  get plugins () {
    return _.values(this._pluginsByLocation)
  }

  findPlugin (location) {
    return this._pluginsByLocation[location]
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

  load (ids, rootDir) {
    if (!_.isArray(ids)) {
      ids = _.toArray(arguments)
    }

    rootDir = rootDir || this._rootDir
    let loader = this.loader

    let createPlugin = (pathOrId) => {
      let base = loader.resolvePlugin(rootDir, pathOrId),
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
        return p.initializeFromDisk(loader)
          .catch((e) => {
            delete this._pluginIsLoading[p.location]
            console.log(e.message)
          })
      });
    }

    let pluginsOnly = (plugins) => {
      return plugins.filter((p) => {
        let isPlugin = !!p._manifest
        if (!isPlugin) {
          delete this._pluginIsLoading[p.location]
        }
        return isPlugin
      })
    }

    let registry = this._registry
    let askForContributions = (plugins) => {
      plugins.forEach((p) => {
        p.transformManifest(registry)
        p.provisionAPI(registry)
      })
      return plugins
    }

    let contributeSingletons = (plugins) => {
      plugins.forEach((p) => {
        p.populateSingletons(registry)
      })
      return plugins
    }

    let contributeExtensions = (plugins) => {
      plugins.forEach((p) => {
        p.distributeExtensions(registry)
      })
      return plugins
    }

    let returnPromise = (plugins) => {
      return plugins.map((p) => {
        let base = p.location
        try {
          p.start()
        } catch (e) {
          console.error(e.stack)
          return
        } finally {
          delete this._pluginIsLoading[base]
        }
        this._pluginsByLocation[base] = p
        this._pluginsByName[p.name] = p
        return p.api
      })
    }

    let pluginsToLoad = ids.map(createPlugin).filter((x) => x)

    return Promise.all(loadManifest(pluginsToLoad))
      .then(pluginsOnly)
      .then(askForContributions)
      .then(contributeSingletons)
      .then(contributeExtensions)
      .then(returnPromise)
      .catch((e) => {

      })
  }

  unload (nameOrLocation) {
    if (_.isArray(nameOrLocation)) {
      nameOrLocation.forEach((p) => {
        this.unload(p)
      })
      return
    }
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
