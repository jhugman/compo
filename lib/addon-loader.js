

let _ = require('underscore'),
    fs = require('fs'),
    path = require('path'),
    resolve = require('resolve')

let LOCALHOST = 'http://0.0.0.0:3000/'

function fetchFile (url) {
  return new Promise((resolve, reject) => {
    try { 
      let string = fs.readFileSync(url)
      resolve(string)
    } catch (e) {
      reject(e)
    }
  })
}

exports.loadTextFileSync = function loadTextFileSync (fullPath) {
  return fs.readFileSync(fullPath, { encoding: 'utf8' })
}

exports.loadJsonFromModule = function loadJSON (base, suffix) {
  let url = resolveFile(base, suffix)
  return fetchFile(url)
    .then((string) => {
      return JSON.parse(string)
    })
}

exports.resolveAddon = function resolveAddon (base, suffix) {
  let pkgSuffix = suffix + '/package.json'
  let pkg = resolve.sync(pkgSuffix, { basedir: base });
  if (!pkg) {
    throw new Error('Addon ' + suffix + ' not found from ' + base)
  }
  return path.dirname(pkg)
}

exports.createSandbox = function createSandbox (addonLoc, suffix) {
  // suffix comes from a known module name, i.e. a filename

  let srcPath = resolve.sync(suffix, { basedir: addonLoc })
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

function resolveFile (base, suffix) {
  return path.resolve(base, suffix)
}
