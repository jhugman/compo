
let constants = require('./constants'),
    EP = constants.EP,
    EP_CONFIG_DEFAULTS = constants.EP_CONFIG_DEFAULTS,
    PERMISSION_ACCESSOR_NAME = constants.PERMISSION_ACCESSOR_NAME

let _ = require('underscore'),
    path = require('path')

class Plugin {
  constructor (base, name, description) {
    this.name = name
    this.location = base
    this.description = description
    this._extensions = []
    this._modules = {}
    this._extensionCache = {}
  }

  initializeFromDisk (loader) {
    let base = this.location
    return loader.loadJsonFromModule(base, 'package.json')
      .then((packageJson) => {
        this.description = packageJson.description
        this.name = packageJson.name
        this.api = new PluginAPI(this.name)
        let manifestFile = packageJson.compo
        if (_.isString(manifestFile)) {
          return loader.loadJsonFromModule(base, manifestFile)
        }
      })
      .then((manifest) => {
        this._manifest = manifest
        return this
      })
  } 

  get extensions () {
    return this._extensions
  }

  start () {
    // Load the npm module's main
    let plugin = this,
        pluginBase
    if (plugin.isStarted) {
      return
    }
    try {
      pluginBase = require(plugin.location)
      plugin.isStarted = true
    } catch (err) {
      console.error('Cannot start ' + plugin.location)
      console.error(err.stack)
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

  transformManifest (registry) {
    let plugin = this, 
        manifest = plugin._manifest
    
    let manifestTransforms = registry.getExtensionPoint(EP.MANIFEST_TRANSFORM).array

    manifestTransforms.forEach((t) => {
      // Should throw if manifest fails test
      t(manifest)
    })

    let extensionTransforms = registry.getExtensionPoint(EP.EXTENSION_TRANSFORM).objectGroups

    let performTransforms = (remaining, addedExtensions) => {
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

  provisionAPI (registry) {
    let plugin = this,
        manifest = this._manifest,
        api = plugin.api
 
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

        // This is where the extension point is attached to the plugin object.
        // Current implementation is that we do nothing special with property 
        // It's difficult to accidentally share plugins.
        accessibleEPs[epID] = ep
      })
      api.extensionPoints = accessibleEPs
    }

    {
      let singletons = manifest.singletons
      if (_.isObject(singletons)) {
        // Automatically grant permission to access singletons that the 
        // plugin registers.
        plugin.grantPermissions(registry, Object.keys(singletons))
      }
    }
  }

  populateSingletons (registry) {
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
    let plugin = this
    let manifest = plugin._manifest
    let singletons = manifest.singletons
    if (_.isObject(singletons)) {
      _.each(manifest.singletons, (i, id) => {
        let singleton = manifest.singletons[id]
        singleton._id = id
        plugin.register(registry, EP.SINGLETONS, singleton)
      })
    }
  }

  distributeExtensions (registry) {
    let plugin = this
    let manifest = plugin._manifest

    // `extensions`: normalized to an array of objects, with the epID filled in.
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
      if (typeof value === 'string') {
        return value.replace(/\b__dirname\b/, this.location)
      } else {
        return value
      }
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
        // Good fences in unload().
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

    let unlistenExtensionPoints = () => {
      _.values(this.api.extensionPoints)
       .forEach((ep) => {
        ep._emitter.removeAllListeners()
       })
    }

    let deleteRequireCache = () => {
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
    }

    return doUnload
      .then(unlistenExtensionPoints)
      .then(deleteRequireCache)
  }


  _loadPluginJavascript (extPath) {
    let plugin = this
    // the extension path is of a form
    // ./relative/module!aProperty
    let cache = plugin._extensionCache

    let moduleName, propertyNames
    {
      let segs = extPath.split('!')
      moduleName = segs.shift()
      propertyNames = segs.length ? segs.join('.').split('.') : []
    }

    if (_.isEmpty(plugin._modules)) {
      plugin.start()
    }

    let moduleExports = plugin._modules[moduleName]
    if (!moduleExports) {
      // Load the extension's module.
      // It is guaranteed* that the require('..') will have the plugin api
      // on it by the time we get to here.
      // * excepting sabotage, it's not secure.
      let modulePath = (moduleName[0] === '.')
        ? path.join(plugin.location, moduleName)
        : moduleName

      try {
        moduleExports = require(modulePath)
        plugin._modules[moduleName] = moduleExports
      } catch (e) {
        console.error(e.stack)
        throw new Error('Error loading ' + modulePath + ': ' + (e.message || e))
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

        // We need a property path for error messages and cache keys.
        if (!propertyPath) {
          // Initialize property path.
          propertyPath = moduleName + '!' + propertyName
        } else {
          // Append to the current propertyName to propertyPath
          propertyPath += '.' + propertyName
        }

        // Now we know what we're going to call it, let's find it.
        let cached = cache[propertyPath]
        if (cached !== undefined) {
          // We don't cache aggressively, but we check here if 
          // we need to do any more work.
          // We should be distinguish between undefined and falsey
          prop_ = cached
        } else {
          // We can try to navigate to this property.
          prop_ = this_[propertyName]
        }

        if (prop_ === undefined && _.isFunction(this_)) {
          // So we have an function Ctor, which didn't have the asked for property, method
          // e.g. Ctor.method
          // Here we assume that this_ is a constructor, and so go ahead and create an object
          // with it, and convert it to an instance. 
          // Then look again to see if the property exists (i.e. on the prototype)

          this_ = cache[thisPath] || this._createObject(this_, thisPath)

          prop_ = this_[propertyName]
          if (prop_ !== undefined) {
            // Now we can cache the instance of the constructor
            // so the class is effectively a singleton.
            cache[thisPath] = this_
          }
        }

        if (prop_ === undefined) {
          throw new Error('Cannot find ' + propertyName + ' in ' + thisPath + ' (in ' + extPath + ')')
        }

        thisPath = propertyPath
      }
    }

    return {
      context: this_,
      object: prop_
    }
  }

  _createObject (Constructor, errorPath) {
    try {
      return new (Function.prototype.bind.call(Constructor))
    } catch (e) {
      console.error('Error loading ' + errorPath, e.stack)
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

class PluginAPI {
  constructor (name) {
    this.name = name
  }
}

module.exports = {Plugin, PluginAPI}
