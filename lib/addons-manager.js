
const PERMISSION_ACCESSOR_NAME = 'addon'

let _ = require('underscore'),
    vm = require('vm')

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
      console.log('Cached  ' + extPath)
      return cache[extPath]
    }
    console.log('Loading ' + extPath)

    let moduleName, propertyNames
    {
      let segs = extPath.split('!')
      moduleName = segs.shift()
      propertyNames = segs
    }

    let moduleExports = addon._modules[moduleName]
    if (!moduleExports) {
      console.log('Loading module: ' + moduleName)
      let sandbox = this.loader.createSandbox(addon.location, moduleName)
      // This is where we set the name of the globally accessible name.
      // This could be 'addon', 'plugin' or 'compo'. I haven't decided.
      sandbox[PERMISSION_ACCESSOR_NAME] = addon.api

      let filename = sandbox.__filename
      let ctx = vm.createContext(sandbox)

      let string = this.loader.loadTextFileSync(filename)
      vm.runInContext(string, ctx, {
        filename: filename,
        displayErrors: true,
      })
      addon._modules[moduleName] = moduleExports = sandbox.module.exports
    } else {
      console.log('Cached  module: ' + moduleName)
    }

    let this_ = null
    let prop_ = moduleExports
    
    {
      let propertyPath = moduleName,
          thisPath = propertyPath

      for (let propertyName of propertyNames) {
        this_ =  prop_

        propertyPath += '!' + propertyName
        // console.log('looking for ', propertyPath)
        let cached = cache[propertyPath]
        if (cached !== undefined) {
          // We don't cache aggressively, but we check here if 
          // we need to do any more work.
          console.log('Cached  property: ' + propertyPath)
          prop_ = cached.object
        } else {
          prop_ = this_[propertyName]
          // console.log('\tnavigated to: ')
        }

        if (prop_ === undefined && _.isFunction(this_)) {
          // console.log('\tconstructing: ', thisPath)
          this_ = this._createObject(this_, thisPath)
          // console.log('\tconstructed: ', thisPath, ' for ', propertyName)
          prop_ = this_[propertyName]
          if (prop_ !== undefined) {
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