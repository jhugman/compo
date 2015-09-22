
const PERMISSION_ACCESSOR_NAME = 'plugin'

let _ = require('underscore'),
    path = require('path')

let EP = {
      PLUGIN_ID: 'internal.compo.plugin.id',
      PLUGIN_LOADER: 'internal.compo.plugin.loader',
      SINGLETONS: 'internal.compo.singletons',
    }

let EP_CONFIG_DEFAULTS = {
  key: '_id', // how the array is transformed into an object
  lazy: false, // is code loaded lazily or eagerly
  stringIs: 'object', // if the extension is just a string, what then?
  description: null, // should be something there, right?
}

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
    registry.description = 'The extension registry gluing everything together. You probably don\'t want this'
    registry.register(EP.SINGLETONS, registry)

    this._loaders = registry.getExtensionPoint(EP.PLUGIN_LOADER)
  }

  unload () {
    let registry = this._registry
    register.unregister(EP.SINGLETONS, registry)
    register.unregister(EP.SINGLETONS, this)
    registry.unregister(EP.PLUGIN_LOADER, require('./plugin-loader'))
  }

  get loader () {
    let all = this._loaders.array
    return all[all.length - 1];
  }

  load (pathOrId) {
    let loader = this.loader,
        base = loader.resolvePlugin(this._rootDir, pathOrId),
        plugin = this._pluginsByLocation[base]

    if (plugin) {
      return Promise.resolve(plugin)
    }

    if (this._pluginIsLoading[base]) {
      // we should return a promise here, to allow multiple promise to 
      return;
    }
    this._pluginIsLoading[base] = true

    let packageJson
    return loader.loadJsonFromModule(base, 'package.json')
      .then((json) => {
        packageJson = json
        plugin = new Plugin(base, packageJson.name, packageJson.description)
        plugin.api = new PluginAPI(packageJson.name)
        let manifestFile = packageJson.compo
        if (manifestFile) {
          return loader.loadJsonFromModule(base, manifestFile)
        }
      })
      .then((manifest) => {
        let isPlugin = false
        if (manifest) {
          this._parseManifest(plugin, manifest)
          isPlugin = true
        }
        manifest = _.pick(packageJson, 'singletons', 'extensions', 'extensionPoints', 'permissions')
        if (!_.isEmpty(manifest)) {
          isPlugin = true
        this._parseManifest(plugin, manifest)
        }
        if (isPlugin) {
        this._pluginsByLocation[base] = plugin
        this._pluginsByName[plugin.name] = plugin
        this._pluginIsLoading[base] = false
        }
        return plugin.api
      })
  }

  _parseManifest (plugin, manifest) {
    // manifest = manifests.normalize(manifest)
    let registry = this._registry
    let api = plugin.api
 
    // We should now set about constructing the api object
    // so it is ready to go when start creating objects which 
    // need access to a fully operational api object.

    // so: permissions, extensionPoints, singletons, extensions

    // `permissions` is asking for access by this plugin 
    /*
      {
        permissions: ['prefs']
      }
     */
    plugin.grantPermissions(registry, manifest.permissions)

    // `extensionPoints`: these need to be done before 
    {
      let accessibleEPs = api.extensionPoints || {}
      _.each(manifest.extensionPoints, (i, epID) => {
        if (epID.indexOf('internal.') === 0) {
          console.warn('Plugin ' + plugin.name + ' has trying to consume a private extension point: ' + epID)
          return
        }
        let ep = registry.getExtensionPoint(epID)
        let config = manifest.extensionPoints[epID]
        config = _.defaults(config, EP_CONFIG_DEFAULTS)

        // TODO What if more than one plugin wants to use the extension point
        ep.key = config.key
        ep.lazy = config.lazy
        ep.description = config.description
        accessibleEPs[epID] = ep
      })
      api.extensionPoints = accessibleEPs
    }

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
        // Automatically grant permission to access singletons that the 
        // plugin registers.
        plugin.grantPermissions(registry, Object.keys(singletons))
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

class Plugin {
  constructor (base, name, description) {
    this.name = name
    this.location = base
    this.description = description
    this._extensions = []
    this._modules = {}
    this._extensionCache = {}
  }

  register (registry, epID, obj) {
    obj = this._preTreatExtension(obj)
    // TODO what to do about lazy loading?
    obj = this.inflate(obj)
    registry.register(epID, obj)
    obj.__epID = epID
    this._extensions.push(obj)
  }

  grantPermissions (registry, permissions) {
    let ep = registry.getExtensionPoint(EP.SINGLETONS)
    ep.key = '_id'
    let api = this.api
    _.each(permissions, (p) => {
      if (Object.getOwnPropertyDescriptor(api, p)) {
        // Stops the same plugin asking for the same permission more 
        // than once.
        return
      }
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

  _preTreatExtension (obj) {
    return _.mapObject(obj, (value, key) => {
      // This forces extension developers to be clear that other 
      // plugins have access to the values in the manifest.
      return value.replace(/\b__dirname\b/, this.location)
    })
  }

  unload (registry) {
    // Unregister all the extensions we've previously registered.
    _.each(this._extensions, (obj) => {
      let epID = obj.__epID
      registry.unregister(epID, obj)
    })

    let doUnload
    if (this.isStarted) {
      let pluginBase = require(this.location)
      if (_.isFunction(pluginBase.unload)) {
        // TODO good fences in unload().
        try {
          let result = pluginBase.unload()
          doUnload = Promise.resolve(result)
            .catch((e) => {
              console.error('Error calling ' + this.name + '.unload():', e.message)
              throw e
            })
        } catch (e) {
          doUnload = Promise.reject(e)
        }
      }
    }

    if (!doUnload) {
      doUnload = Promise.resolve()
    }

    return doUnload.then(() => {
      // Now, delete all the Javascript from the require.cache.
      // When we load the plugin again, we will 
      let requiredPaths = _.keys(require.cache)
      let location = this.location
      _.each(requiredPaths, (modulePath) => {
        if (modulePath.indexOf(location) === 0) {
          delete require.cache[modulePath]
        }
      })
      return this
    })

    

  }


  _loadPluginJavascript (extPath) {
    let plugin = this
    // the extension path is of a form
    // ./relative/module!aProperty
    let cache = plugin._extensionCache
    if (cache[extPath]) {
      return cache[extPath]
    }

    let moduleName, propertyNames
    {
      let segs = extPath.split('!')
      moduleName = segs.shift()
      propertyNames = segs.length ? segs.join('.').split('.') : []
    }

    if (_.isEmpty(plugin._modules)) {
      // Load the npm module's main
      let pluginBase
      try {
        pluginBase = require(plugin.location)
        plugin.isStarted = true
      } catch (err) {
        console.error('Cannot start ' + plugin.location)
        throw err
      }
      // and give it the plugin api.
      // This is a horrible hack, but it now lets plugins 
      // access singletons/permissions through 
      // require('.').plugin or require('..').plugin
      pluginBase[PERMISSION_ACCESSOR_NAME] = plugin.api

      // It does not make for pretty code within the main module itself
      // however, because the plugin api will only be accessible after 
      // the first run of the module. 
      // Instead, you should use exports.plugin within event listeners.
      // It could be usefully argued that the main (activator in OSGi speak)
      // is the most likely candidate for special boiler plate.
    }

    let moduleExports = plugin._modules[moduleName]
    if (!moduleExports) {
      // Load the extension's module.
      // It is guaranteed* that the require('..') will have the plugin api
      // on it by the time we get to here.
      // * excepting sabotage, it's not secure. 
      let modulePath = path.join(plugin.location, moduleName)
      try {
        moduleExports = require(modulePath)
        plugin._modules[moduleName] = moduleExports
      } catch (e) {
        throw new Error('Error loading ' + moduleName + ': ' + e.message)
      }
    }

    // prop_ is our final result. 
    // this_ is the context where we search for the next prop_
    let this_ = null,
        prop_ = moduleExports
    
    {
      let thisPath = moduleName,
          propertyPath

      for (let propertyName of propertyNames) {
        if (!propertyName) {
          // This is to stop '..' oddities.
          // but also fixes a bug with the join/split leaving empty strings
          continue
        }
        this_ =  prop_

        if (!propertyPath) {
          propertyPath = moduleName + '!' + propertyName
        } else {
          propertyPath += '.' + propertyName
        }

        // Now we know what we're going to call it, let's find it.
        let cached = cache[propertyPath]
        if (cached !== undefined) {
          // We don't cache aggressively, but we check here if 
          // we need to do any more work.
          prop_ = cached.object
        } else {
          // We can try to navigate to this property.
          prop_ = this_[propertyName]
        }

        if (prop_ === undefined && _.isFunction(this_)) {
          // So we have an function Ctor, which didn't have the asked for property, method
          // e.g. Ctor.method
          // Here we assume that Ctor is a constructor, and so go ahead and create an object
          // with it. Then look again to see if the property exists (i.e. on the prototype)
          this_ = this._createObject(this_, thisPath)
          prop_ = this_[propertyName]
          if (prop_ !== undefined) {
            // Now we can cache the instance of the constructor
            // so the class is effectively a singleton.
            cache[thisPath] = {
              context: null,
              object: this_,
            }
          }
        }

        if (prop_ === undefined) {
          throw new Error('Cannot find ' + propertyName + ' in ' + thisPath + ' (in ' + extPath + ')')
        }

        thisPath = propertyPath
      }
    }

    cache[extPath] = {
      context: this_,
      object: prop_
    }

    return cache[extPath]
  }

  _createObject (Constructor, errorPath) {
    try {
      return new (Function.prototype.bind.call(Constructor))
    } catch (e) {
      console.error('Error loading ' + errorPath, e)
    }
  }

  inflate (extension) {
    let plugin = this
    // We're expecting extensions to look like
    /* 
    {
      "function": "./path/to/module!aFunction"
      "object": "./path/to/module!Ctor"
    }
     */ 
    let extType, extPath
    {
      for (let t of ['function', 'object']) {
        if (extension[t]) {
          extType = t
          extPath = extension[t]
        }
      }
    }

    if (!extType) {
      // The extension is neither a function nor an object.
      // We should just give it back.
      return extension
    }

    let codeObject = this._loadPluginJavascript(extPath)

    let returnValue = codeObject.object,
        context = codeObject.context
    switch (extType) {
      case 'object':
        if (_.isFunction(returnValue)) {
          codeObject.object = returnValue = this._createObject(returnValue, extPath)
          codeObject.context = context = undefined
        }
        break;
      case 'function':
        if (_.isFunction(returnValue) && context) {
          codeObject.object = returnValue = returnValue.bind(codeObject.context)
          codeObject.context = context = undefined
        }
        break
      default: 
        if (_.isFunction(returnValue)) {
          console.warn('Cannot tell if ' + extPath + ' is a constructor or a function. Assuming a function.')
        }
    }

    if (_.isObject(returnValue) && _.isObject(extension)) {
      _.extend(returnValue, extension)
    }

    return returnValue
  }
}

exports._Plugin = Plugin

class PluginAPI {
  constructor (name) {
    this.name = name
  }
}