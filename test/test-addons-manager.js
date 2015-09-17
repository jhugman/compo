'use strict';
let test = require('tap').test,
    path = require('path')


let Registry = require('../lib/registry').Registry, 
    AddonManager = require('../lib/addons-manager').AddonManager,
    _Addon = require('../lib/addons-manager')._Addon

test('manifest loaded', (t) => {
  let registry = new Registry()
  let addons = new AddonManager(registry, path.join(__dirname, 'fixtures'))
  //t.ok(addons)

  let loadAddon = addons.load('./hello-world')

  t.ok(loadAddon, 'loading an addon returns something')
  t.ok(loadAddon.then, 'it looks like a promise')

  loadAddon
    .then((addon) => {
      t.ok(addon, 'addon exists')
      t.ok(addon.hasOwnProperty('notAvailable'), 'addon is allowed notAvailable, even if it is not available')
      t.notOk(addon.hasOwnProperty('notAllowed'), 'addon has no access to a singleton not requested in the manifest')
      
      t.ok(addon.hasOwnProperty('epTester'), 'addon has epTester allowed')
      t.equal(addon.epTester.prop1, 'yes', 'addon has epTester from manifest')
      
      t.throws(() => {
        // has asked for permission, but no singleton was available
        let singleton = addon.notAvailable
      })
      t.end()
    })
    .catch((err) => {
      console.error('ERROR ', err.message)
      console.error(err.stack)
      t.fail()
    })
})

test('Reifying extensions (low level)', (t) => {
  let registry = new Registry()
  let rootDir = path.join(__dirname, 'fixtures')
  let addons = new AddonManager(registry, rootDir)

  let addon = new _Addon(path.join(rootDir, 'hello-world'), 'hello-world')

  let mod = addon._loadAddonJavascript('./lib/ep-extensions').object
  t.ok(mod, 'Something has loaded as a module')
  t.ok(mod.aFunction, 'It looks like a legit module')

  let fn = addon._loadAddonJavascript('./lib/ep-extensions!aFunction').object
  t.ok(fn, 'Something has loaded as a function')
  t.equal(typeof fn, 'function', 'It is a function')

  t.equal(fn, mod.aFunction, 'Function has come from the module')

  // let Cls = addon._loadAddonJavascript('./lib/ep-extensions!aClass').object
  // t.ok(Cls, 'Constructor object has loaded')
  let method = addon._loadAddonJavascript('./lib/ep-extensions!aObject.aMethod').object
  t.ok(method, 'Method object has loaded')

  let obj = addon._loadAddonJavascript('./lib/ep-extensions!AConstructor.getter')
  let getter = obj.object.bind(obj.context)
  t.equal(typeof getter, 'function', 'getter')

  obj = addon._loadAddonJavascript('./lib/ep-extensions!AConstructor.setter')
  let setter = obj.object.bind(obj.context)

  setter(4)
  t.equal(getter(), 4, 'Instance of AConstructor was cached')

  t.end()
})

test('Reifying extensions (high level)', (t) => {
  let registry = new Registry()
  let rootDir = path.join(__dirname, 'fixtures')
  let addons = new AddonManager(registry, rootDir)

  let addon = new _Addon(path.join(rootDir, 'hello-world'), 'hello-world')

  let mod = addon.inflate({ object: './lib/ep-extensions' })
  t.ok(mod, 'Something has loaded as a module')
  t.ok(mod.aFunction, 'It looks like a legit module')

  let fn = addon.inflate({ function: './lib/ep-extensions!aFunction' })
  t.ok(fn, 'Something has loaded as a function')
  t.equal(typeof fn, 'function', 'It is a function')

  t.notEqual(fn(5), 5, 'Function has come from the module')
  t.equal(fn(5), 6, 'Function called with auto-filled this')

  t.notEqual(mod.aFunction(6), 6, 'Function called from without the vm')
  t.equal(mod.aFunction(6), 7, 'Function called with this implied by the caller')
  


  let method = addon.inflate({ function: './lib/ep-extensions!aObject.aMethod' })
  t.ok(method, 'Method object has loaded')

  let getter = addon.inflate({ function: './lib/ep-extensions!AConstructor.getter' })
  
  t.equal(typeof getter, 'function', 'getter')

  let setter = addon.inflate({ function: './lib/ep-extensions!AConstructor.setter' })

  setter(4)
  t.equal(getter(), 4, 'Instance of AConstructor was cached')

  t.end()
})