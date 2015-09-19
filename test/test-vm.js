let vm = require('vm'),
    fs = require('fs'),
    path = require('path'),
    resolve = require('resolve'),
    test = require('tap').test


var loader = require('../lib/plugin-loader')
let createSandbox = function createSandbox (pluginLoc, suffix) {
  // suffix comes from a known module name, i.e. a filename

  let srcPath = resolve.sync(suffix, { basedir: pluginLoc })
  let basedir = path.dirname(srcPath)
  
  let _require = function (m) {
    let modulePath = resolve.sync(m, { basedir: basedir })
    return require(modulePath)
  }

  var _exports = {}
  return {
    module: {
      id: srcPath,
      exports: _exports,
      filename: srcPath,
      require: _require,
    },
    require: _require,
    __filename: srcPath,
    __dirname: basedir,
    exports: _exports,
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    
  }
}


test('Testing methods in a vm', (t) => {
  let pluginLoc = path.join(__dirname, 'fixtures/hello-world')
  let sandbox = createSandbox(pluginLoc, './lib/ep-vm.js')

  let filename = sandbox.__filename
  let string = fs.readFileSync(filename, { encoding: 'utf8' })
  
  t.ok(string, 'ep-vm.js loaded')
  t.equal(typeof(string), 'string', 'ep-vm.js is loaded as string')

  let plugin = new class {
    constructor () {
      this.count = 0
      this.state = {}
    }
    increment (x) {
      this.count += x
    }
  }

  sandbox.t = t
  sandbox.plugin = plugin
  let ctx = vm.createContext(sandbox)

  vm.runInContext(string, ctx, {
    filename: filename,
    displayErrors: true,
  })

  t.equal(plugin.count, 2, 'Side effects are felt outside the vm context')

  t.equal(typeof plugin.setter, 'function', 'Plugins can add functions to their context')
  plugin.setter(3)
  t.equal(plugin.getter(), 3, 'Calling functions from outside can have side effects in the vm context')
  t.equal(plugin.state.flag, 3, 'Side effects from vm context can be on shared objects')
  t.equal(plugin.flag, 3, 'Side effects from vm context can be on directly shared objects')

  t.end()
})


test('Loading objects via require in a vm', (t) => {
  let basename = path.join(__dirname, 'fixtures/hello-world/lib')
  let filename = path.join(basename, 'ep-vm')

  let ctx
  {
    let _require = function (m) {
      let modulePath = resolve.sync(m, { basedir: basename });
      return require(modulePath)
    }
    
    ctx = vm.createContext({
      require: _require,
    })
  }


  let result = vm.runInContext('require("./ep-extensions")', ctx, {
    filename: filename,
    displayErrors: true,
  })

  t.ok(result, 'A result comes from the vm')
  t.equal(typeof result.aFunction, 'function', 'A function is returned')

  t.end()
})


test('Loading objects with sandbox from loader', (t) => {
  let pluginLoc = path.join(__dirname, 'fixtures/hello-world')
  let sandbox = createSandbox(pluginLoc, './lib/ep-vm')

  let ctx = vm.createContext(sandbox)
  let result = vm.runInContext('require("./ep-extensions")', ctx, {
    filename: './lib/ep-vm',
    displayErrors: true,
  })
  t.ok(result, 'A result comes from the vm')
  t.equal(typeof result.aFunction, 'function', 'A function is returned')
  t.end()
})
