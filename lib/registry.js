'use strict';

let ExtensionPoint = require('./extension-points').ExtensionPoint

// TODO don't be so protective over registry internals.
let getOrCreateExtensionPoint = (state, epid, token) => {
  let ep = state._extensionPoints[epid];
  if (ep) {
    return ep
  }
  ep = new ExtensionPoint(epid)
  state._extensionPoints[epid] = ep
  return ep
}

exports.Registry = class Registry {

  constructor () {
    this.state = { _extensionPoints: {} }
  }

  // 'extensions' are registered and unregistered with an extension point.
  // The 'extensionPointId' is provided by another developer. If the developer 
  // documents it somewhere, then other people can use it.
  // 'extensions' are objects specified by the extension point.
  register (extensionPointId, object) {
    var ep = getOrCreateExtensionPoint(this.state, extensionPointId);
    ep.registerExtension(object);
    return this
  }

  unregister (extensionPointId, object) {
    var ep = getOrCreateExtensionPoint(this.state, extensionPointId);
    ep.unregisterExtension(object)
  }

  getExtensionPoint (extensionPointId) {
    // we should never allow unfettered access to any extension point.
    if (!extensionPointId) {
      throw new Error('Extension point id must be supplied')
    }
    var ep = getOrCreateExtensionPoint(this.state, extensionPointId);
    return ep.api
  }
}
