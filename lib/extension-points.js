'use strict';

let _ = require('underscore')

/*
 * This is the ExtensionPoint object that the registry sees.
 * 
 * Consumers of the extension point will see an ExtensionPointAPI object,
 * which is designed only expose the extensions and events to add and remove them.
 * 
 * This object provides extension registration methods, and enough access control 
 * to make it difficult to access an extension point without indicating an interest 
 * in the manifest.json. 
 * 
 */
exports.ExtensionPoint = class ExtensionPoint {
  constructor (id, /*...*/credentials) {
    this._ep = new ExtensionPointAPI(id)
    this._credentials = credentials
  }


  /*
   * The extension point is a dynamic list of 'extension' objects.
   * Registering an extension adds to that list of objects.
   */
  registerExtension (object) {
    // TODO dedupe to be really nice
    let ep = this._ep
    // The latest version of the list, which clients can make views of
    ep._backingArray.push(object)
    // Emit to any listeners that clients may want informed.
    ep._emitter.emit('add', object)
    return this
  }

  unregisterExtension (object) {
    let ep = this._ep
    ep._backingArray = ep._backingArray.filter((o) => {
      if (o.isMetadata) {
        o = o.metadata
      }
      return object !== o
    })
    ep._emitter.emit('remove', object)
    return this
  }

  /**
   * This is not yet fleshed out, though is intended for 
   * the manifest parser to be able to add things in to 
   * the registry. If the extension is supposed to have 
   * methods, then there should be a way of finding them,
   * and cause them to be executed.
   */
  registerMetadata (metadata) {
    this.registerExtension({
      isMetadata: true,
      metadata: metadata,
    })
  }

  grantAccess (/*...*/credentials) {
    this._credentials = [/*...*/this._credentials, /*...*/credentials]
  }

  revokeAccess (/*...*/credentials) {
    this._credentials = _.difference(this._credentials, credentials)
  }

  isGuarded () {
    return !!this._credentials.length
  }

  accessWith (token) {
    return true
  }

  get api () {
    return this._ep
  }

}

let EventEmitter = require('events').EventEmitter
/* ExtensionPoints are dynamic list of extensions.
 * - Clients can access the current state at any time.
 * - Clients may listen for extensions being added (registered) or 
 * removed.
 * This is the extension point that the registry will 
 * give back to validated clients.
 *
 */
class ExtensionPointAPI {
  constructor (id) {
    this.id = id
    this._emitter = new EventEmitter()
    this._backingArray = []
  }

  extensionsArrayView (all) {
    return this._backingArray
  }

  extensionsObjectView (idProperty) {
    idProperty = idProperty ||  '_id'
    let view = {}
    this._backingArray.forEach((extension) => {
      let key = extension[idProperty]
      view[key] = extension
    })
    return view
  }

  onAdd (listener) {
    this._backingArray.forEach((extension) => {
      listener(extension)
    })
    this._emitter.on('add', listener)
    return this
  }

  onRemove (listener) {
    this._emitter.on('remove', listener)
    return this
  }

  removeListener (listener) {
    this._emitter.removeListener('remove', listener)
    this._emitter.removeListener('add', listener)
  }

}
