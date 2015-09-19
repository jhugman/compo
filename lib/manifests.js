let _ = require('underscore')

exports.parseManifest = function parseManifest (registry, extensionPoints, plugin) {
  let manifest = plugin.manifest
  
  let pluginExtensions = manifest.extensions
  let pluginExtensionPoints = manifest['extension-points']


  // Special cases


  // Generic extensions.
  if (_.isArray(pluginExtensions)) {
    pluginExtensions.forEach((item) => {
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
  } else if (_.isObject(pluginExtensions)) {
    pluginExtensions.forEach((i, epid) => {
      let ext = pluginExtensions[epid]
      if (epid && ext) {
        registry.register(epid, ext)
      }
    })
  }
  if (_.isObject(pluginExtensionPoints) && !_.isArray(pluginExtensionPoints)) {
    pluginExtensionPoints = _.keys(pluginExtensionPoints)
  }
  if (_.isArray(pluginExtensionPoints)) {
    pluginExtensionPoints.forEach((epid) => {
      /*extensionPoints(epid).grantAccess(uuid)*/
    })
  }

}

exports.unparseManifest = function unparseManifest (registry, extensionPoints, plugin) {
  let manifest = plugin.manifest
  
  let pluginExtensions = manifest.extensions
  let pluginExtensionPoints = manifest['extension-points']


  // Special cases


  // Generic extensions.
  if (_.isArray(pluginExtensions)) {
    pluginExtensions.forEach((item) => {
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
  } else if (_.isObject(pluginExtensions)) {
    pluginExtensions.forEach((i, key) => {
    })
  }
  if (_.isObject(pluginExtensionPoints) && !_.isArray(pluginExtensionPoints)) {
    pluginExtensionPoints = _.keys(pluginExtensionPoints)
  }
  if (_.isArray(pluginExtensionPoints)) {
    pluginExtensionPoints.forEach((epid) => {
      // extensionPoints(epid).revokeAccess(uuid)
    })
  }
}