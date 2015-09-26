'use strict';
let test = require('tap').test,
    path = require('path')


let Registry = require('../lib/registry').Registry, 
    PluginManager = require('../lib/plugin-manager').PluginManager,
    _Plugin = require('../lib/plugin-manager')._Plugin

test('manifest loaded', (t) => {
  let registry = new Registry()
  let plugins = new PluginManager(registry, path.join(__dirname, 'fixtures'))
  //t.ok(plugins)

  let loadPlugin = plugins.load('./hello-world')

  t.ok(loadPlugin, 'loading an plugin returns something')
  t.ok(loadPlugin.then, 'it looks like a promise')

  loadPlugin
    .then((plugins) => {
      let plugin = plugins[0]
      t.ok(plugin, 'plugin exists')
      t.ok(plugin.hasOwnProperty('notAvailable'), 'plugin is allowed notAvailable, even if it is not available')
      t.notOk(plugin.hasOwnProperty('notAllowed'), 'plugin has no access to a singleton not requested in the manifest')
      
      t.ok(plugin.hasOwnProperty('epTester'), 'plugin has epTester allowed')
      t.equal(plugin.epTester.prop1, 'yes', 'plugin has epTester from manifest')
      
      t.throws(() => {
        // has asked for permission, but no singleton was available
        let singleton = plugin.notAvailable
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
  let plugins = new PluginManager(registry, rootDir)

  let plugin = new _Plugin(path.join(rootDir, 'hello-world'), 'hello-world')

  let mod = plugin._loadPluginJavascript('./lib/ep-extensions').object
  t.ok(mod, 'Something has loaded as a module')
  t.ok(mod.aFunction, 'It looks like a legit module')

  let fn = plugin._loadPluginJavascript('./lib/ep-extensions!aFunction').object
  t.ok(fn, 'Something has loaded as a function')
  t.equal(typeof fn, 'function', 'It is a function')

  t.equal(fn, mod.aFunction, 'Function has come from the module')

  // let Cls = plugin._loadPluginJavascript('./lib/ep-extensions!aClass').object
  // t.ok(Cls, 'Constructor object has loaded')
  let method = plugin._loadPluginJavascript('./lib/ep-extensions!aObject.aMethod').object
  t.ok(method, 'Method object has loaded')

  let obj = plugin._loadPluginJavascript('./lib/ep-extensions!AConstructor.getter')
  let getter = obj.object.bind(obj.context)
  t.equal(typeof getter, 'function', 'getter')

  obj = plugin._loadPluginJavascript('./lib/ep-extensions!AConstructor.setter')
  let setter = obj.object.bind(obj.context)

  setter(4)
  t.equal(getter(), 4, 'Instance of AConstructor was cached')

  t.end()
})

test('Reifying extensions (high level)', (t) => {
  let registry = new Registry()
  let rootDir = path.join(__dirname, 'fixtures')
  let plugins = new PluginManager(registry, rootDir)

  let plugin = new _Plugin(path.join(rootDir, 'hello-world'), 'hello-world')

  let mod = plugin.inflate({ object: './lib/ep-extensions' })
  t.ok(mod, 'Something has loaded as a module')
  t.ok(mod.aFunction, 'It looks like a legit module')

  let fn = plugin.inflate({ function: './lib/ep-extensions!aFunction' })
  t.ok(fn, 'Something has loaded as a function')
  t.equal(typeof fn, 'function', 'It is a function')

  t.notEqual(fn(5), 5, 'Function has come from the module')
  t.equal(fn(5), 6, 'Function called with auto-filled this')

  t.notEqual(mod.aFunction(6), 6, 'Function called from without the vm')
  t.equal(mod.aFunction(6), 7, 'Function called with this implied by the caller')
  


  let method = plugin.inflate({ function: './lib/ep-extensions!aObject.aMethod' })
  t.ok(method, 'Method object has loaded')

  let getter = plugin.inflate({ function: './lib/ep-extensions!AConstructor.getter' })
  
  t.equal(typeof getter, 'function', 'getter')

  let setter = plugin.inflate({ function: './lib/ep-extensions!AConstructor.setter' })

  setter(4)
  t.equal(getter(), 4, 'Instance of AConstructor was cached')

  t.end()
})