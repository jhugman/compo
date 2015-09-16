
const PERMISSION_ACCESSOR_NAME = 'addon'

let _ = require('underscore'),
    path = require('path')

let EP = {
      ADDON_ID: 'internal.compo.addon.id',
      ADDON_LOADER: 'internal.compo.addon.loader',
      SINGLETONS: 'internal.compo.singletons',
    }

let EP_CONFIG_DEFAULTS = {
  key: '_id', // how the array is transformed into an object
  lazy: false, // is code loaded lazily or eagerly
  stringIs: 'object', // if the extension is just a string, what then?
}

exports.AddonManager = class AddonManager {

  constructor (registry, cwd) {
    this._registry = registry
    this._rootDir = cwd || process.cwd()
    this._addonsByLocation = {}
    this._addonsByName = {}
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
        addon = this._addonsByLocation[base]

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

        this._addonsByLocation[base] = addon
        this._addonsByName[addon.name] = addon
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
      _.each(manifest.singletons, (i, id) => {
        let singleton = manifest.singletons[id]
        singleton._id = id
        addon.register(registry, EP.SINGLETONS, singleton)
      })
    }

    // `permissions` is asking for access by this addon 
    /*
      {
        permissions: ['prefs']
      }
     */
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
          addon.register(registry, ex.epID, ex)
        }
      })
    }

    {
      let accessibleEPs = {}
      _.each(manifest.extensionPoints, (i, epID) => {
        if (epID.indexOf('internal.') === 0) {
          console.warn('Addon ' + addon.name + ' has trying to consume a private extension point: ' + epID)
          return
        }
        let ep = registry.getExtensionPoint(epID)
        let config = manifest.extensionPoints[epID]
        config = _.defaults(config, EP_CONFIG_DEFAULTS)

        ep.key = config.key
        ep.lazy = config.lazy

        accessibleEPs[epID] = ep
      })
      api.extensionPoints = accessibleEPs
    }
  }

  unload (nameOrLocation) {
    let addon = this._addonsByLocation[nameOrLocation] || this._addonsByName[nameOrLocation]
    if (!addon) {
      return
    }

    addon.dispose(this._registry)

    delete this._addonsByLocation[addon.location]
    delete this._addonsByName[addon.name]
  }

  _loadAddonJavascript (addon, extPath) {
    // the extension path is of a form
    // ./relative/module!aProperty
    let cache = addon._extensionCache
    if (cache[extPath]) {
      return cache[extPath]
    }

    let moduleName, propertyNames
    {
      let segs = extPath.split('!')
      moduleName = segs.shift()
      propertyNames = segs.join('.').split('.')
    }

    if (_.isEmpty(addon._modules)) {
      // Load the npm module's main
      let addonBase = require(addon.location)
      // and give it the addon api.
      // This is a horrible hack, but it now lets addons 
      // access singletons/permissions through 
      // require('.').addon or require('..').addon
      addonBase[PERMISSION_ACCESSOR_NAME] = addon.api

      // It does not make for pretty code within the main module itself
      // however, because the addon api will only be accessible after 
      // the first run of the module. 
      // Instead, you should use exports.addon within event listeners.
      // It could be usefully argued that the main (activator in OSGi speak)
      // is the most likely candidate for special boiler plate.
    }

    let moduleExports = addon._modules[moduleName]
    if (!moduleExports) {
      // Load the extension's module.
      // It is guaranteed* that the require('..') will have the addon api
      // on it by the time we get to here.
      // * excepting sabotage, it's not secure. 
      let modulePath = path.join(addon.location, moduleName)
      moduleExports = require(modulePath)
      addon._modules[moduleName] = moduleExports
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

  _reifyExtension (addon, extension) {
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
      throw new Error('Not clear if this is an executable piece of code ' + JSON.stringify(extension));
    }

    let codeObject = this._loadAddonJavascript(addon, extPath)

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

    if (_.isObject(returnValue)) {
      _.extend(returnValue, extension)
    }

    return returnValue
  }
}

class Addon {
  constructor (base, name) {
    this.name = name
    this.location = base
    this._extensions = []
    this._modules = {}
    this._extensionCache = {}
  }

  register (registry, epID, obj) {
    registry.register(epID, obj)
    obj.__epID = epID
    this._extensions.push(obj)
  }

  dispose (registry) {
    _.each(this._extensions, (obj) => {
      let epID = obj.__epID
      registry.unregister(epID, obj)
    })

    let requiredPaths = _.keys(require.cache)
    let location = this.location
    _.each((modulePath) => {
      if (modulePath.indexOf(location) === 0) {
        delete require.cache[modulePath]
      }
    })
  }
}

class AddonAPI {
  constructor () {
    _.extend(this, {
      _extensionPoints: {},
    })
  }
}