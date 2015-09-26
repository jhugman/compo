

// The extension point provides access to the registered extensions.
// Access to the extension points are only through the plugins.extensions.getExtensionPoint(id).
// The extension point is an array 
let ExtensionPoint = {

  // All extensions registered with the extension point.
  get array () {}

  // An up-to-date object view of key value pairs of a string to extensions, where `key` 
  // is configured by the manifest. By default, the `__id` property of the extension is used 
  // to transform the array to an object.
  // Extensions with duplicate keys are ignored.
  get object () {}

  // An up-to-date object view of key-list of values of the extensions. `key` is 
  get objectGroups () {}

  // At the point of running a method, the extensions stored in extensions as Object and Array
  // may be only the metadata added by the manifest.
  
  // Fire this callback if a new extension is added to this extension point.
  // On attachment, the callback is fired once for each extension already registered.
  // ((extension) => void):
  onAdd (listener) {}

  // Fire this callback if an extension is removed from this extension point.
  // ((extension) => void):
  onRemove (listener) {}

  removeListener (listener) {},
}

// The Plugin is the object that plugins consume extensions and singletons from the app.
// Singletons that have been asked for in the 'permissions' section of the plugin's manifest.
let Plugin = {
  // An object containing id -> extension point map.
  // Only the extension points declared in the 'extensionPoints' section of the plugin's 
  // manifest is available.
  get extensionPoints () {}
}


