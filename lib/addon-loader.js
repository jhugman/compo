

let _ = require('underscore')
let manifests = require('./manifests')

let LOCALHOST = 'http://0.0.0.0:3000/'

function fetchFile (url) {
  return new Promise((resolve, reject) => {
    
    // fetchUrl(url, (error, meta, body) => {
    //   if (error) {
    //     return reject(error, meta)
    //   }
    //   return resolve(body, meta)
    // })
  })
}

function loadJSON (url) {
  return fetchFile(url)
    .then((body, meta) => JSON.parse(body.toString()))
    .catch((err) => {
      console.log('ERROR', err)
    })
}

exports.loadAddon = function loadAddon (registry, extensionPoints, manifestURL_relative) {
  let addon = new Addon({
    manifestURL: manifestURL_relative,
    // This uuid is generated at load time. It is not supposed to be available 
    // to other addons.
    // It is intended that registry access to use these secret UUIDs
    // to limit access to extension points.
    // In order to programatically access an extension point, then you need to 
    // declare an interest in the manifest.json
    uuid: 'doesnot matter'
  })

  return loadJSON(LOCALHOST + manifestURL_relative)
    .then((manifest) => {
      addon.manifest = manifest
      manifests.parseManifest(registry, extensionPoints, addon)
      return addon
    })
}

exports.unloadAddon = function unloadAddon (registry, extensionPoints, addon) {

}


class Addon {
  constructor (opts) {
    _.extend(this, opts)
  }
}