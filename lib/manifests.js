let _ = require('underscore')

exports.parseManifest = function parseManifest (registry, extensionPoints, addon) {
  let manifest = addon.manifest
  
  let addonExtensions = manifest.extensions
  let addonExtensionPoints = manifest['extension-points']


  // Special cases


  // Generic extensions.
  if (_.isArray(addonExtensions)) {
    addonExtensions.forEach((item) => {
      let epid, ext
      if (_.isArray(item)) {
        epid = item[0]
        ext = item[1]
      } else if (_.isObject(item)) {
        epid = item['extends']
        ext = item
      }

      if (epid && ext) {
        registry.register(epid, ext)
      }
    })
  } else if (_.isObject(addonExtensions)) {
    addonExtensions.forEach((i, epid) => {
      let ext = addonExtensions[epid]
      if (epid && ext) {
        registry.register(epid, ext)
      }
    })
  }
  if (_.isObject(addonExtensionPoints) && !_.isArray(addonExtensionPoints)) {
    addonExtensionPoints = _.keys(addonExtensionPoints)
  }
  if (_.isArray(addonExtensionPoints)) {
    addonExtensionPoints.forEach((epid) => {
      /*extensionPoints(epid).grantAccess(uuid)*/
    })
  }

}

exports.unparseManifest = function unparseManifest (registry, extensionPoints, addon) {
  let manifest = addon.manifest
  
  let addonExtensions = manifest.extensions
  let addonExtensionPoints = manifest['extension-points']


  // Special cases


  // Generic extensions.
  if (_.isArray(addonExtensions)) {
    addonExtensions.forEach((item) => {
      let epid, ext
      if (_.isArray(item)) {
        epid = item[0]
        ext = item[1]
      } else if (_.isObject(item)) {
        epid = item['extends']
        ext = item
      }

      if (epid && ext) {
        registry.unregister(epid, ext)
      }
    })
  } else if (_.isObject(addonExtensions)) {
    addonExtensions.forEach((i, key) => {
    })
  }
  if (_.isObject(addonExtensionPoints) && !_.isArray(addonExtensionPoints)) {
    addonExtensionPoints = _.keys(addonExtensionPoints)
  }
  if (_.isArray(addonExtensionPoints)) {
    addonExtensionPoints.forEach((epid) => {
      // extensionPoints(epid).revokeAccess(uuid)
    })
  }
}