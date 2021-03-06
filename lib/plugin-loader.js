

let _ = require('underscore'),
    fs = require('fs'),
    path = require('path'),
    resolve = require('resolve')

let LOCALHOST = 'http://0.0.0.0:3000/'

function fetchFile (url) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(url)) {
      reject(new Error('Can\'t find ' + url))
    }
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
      try {
        return JSON.parse(string)
      } catch (ex) {
        console.error('Error parsing ' + url + ': ' + ex.message)
        return Promise.reject(ex)
      }
    })
}

exports.resolvePlugin = function resolvePlugin (base, suffix) {
  let pkgSuffix = suffix + '/package.json'
  let pkg = resolve.sync(pkgSuffix, { basedir: base });
  if (!pkg) {
    throw new Error('Plugin ' + suffix + ' not found from ' + base)
  }
  let dir = path.dirname(pkg)
  // Find the location on disk where the module is. 
  // This is important to be accurate because the require.cache
  // uses readlink -f.
  while (fs.lstatSync(dir).isSymbolicLink()) {
    let rel = fs.readlinkSync(dir)
    dir = path.resolve(dir, '..', rel)
  }
  return dir
}

function resolveFile (base, suffix) {
  return path.resolve(base, suffix)
}
