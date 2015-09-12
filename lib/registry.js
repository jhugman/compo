'use strict';

let state = {
  extensionPoints: {},
};

let ExtensionPoint = require('./extension-points').ExtensionPoint

let getOrCreateExtensionPoint = (state, epid, token) => {
  let ep = state.extensionPoints[epid];
  if (ep) {
    return ep;
  }
  ep = new ExtensionPoint(epid);
  if (token && !ep.isGuarded()) {
    ep.grantAccess(token)
  }
  state.extensionPoints[epid] = ep;
  return ep;
};


exports.Registry = class Registry {
  // 'extensions' are registered and unregistered with an extension point.
  // The 'extensionPointId' is provided by another developer. If the developer 
  // documents it somewhere, then other people can use it.
  // 'extensions' are objects specified by the extension point.
  register (extensionPointId, object) {
    var ep = getOrCreateExtensionPoint(state, extensionPointId);
    ep.registerExtension(object);
    return this
  }

  // extensions can be lazily loaded (so as not to impact initial load time)
  // This method would be used by the manifest parser.
  registerMetadata (extensionPointId, metadata, addon) {
    var ep = getOrCreateExtensionPoint(state, extensionPointId);

    ep.registerMetadata(object, addon);
    return this
  }

  unregister (extensionPointId, object) {
    var ep = getOrCreateExtensionPoint(state, extensionPointId);
    ep.unregisterExtension(object)
  }

  getExtensionPoint (extensionPointId, credentials) {
    var ep = getOrCreateExtensionPoint(state, extensionPointId, credentials);
    if (ep.accessWith(credentials)) {
      return ep.api
    }
    throw new Error('Programmatic access to an extension point requires listing in the manifest.json and using the access token provided by addon.onLoad')
  }
}

exports.createAddons = function createAddons(registry) {
  let createAddons = require('./registry-addons').create
  let extensionPoints = (epid) => getOrCreateExtensionPoint(state, epid)
  let opts = {
    extensionPoints,
    registry, 
  }
  return createAddons(opts)
}