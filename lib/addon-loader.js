

let _ = require('underscore'),
    fs = require('fs'),
    path = require('path'),
    resolve = require('resolve')

let LOCALHOST = 'http://0.0.0.0:3000/'

function fetchFile (url) {
  return new Promise((resolve, reject) => {
    try { 
      console.log('fetchFile: ' + url)
      let string = fs.readFileSync(url)
      resolve(fs.readFileSync(url))
    } catch (e) {
      reject(e)
    }
  })
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

function loadJavascript() {

}

function resolveFile (base, suffix) {
  return path.resolve(base, suffix)
}
