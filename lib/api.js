var Registry = {
  // 'extensions' are registered and unregistered with an extension point.
  // The 'extensionPointId' is provided by another developer. If the developer 
  // documents it somewhere, then other people can use it.
  // 'extensions' are objects specified by the extension point.
  register: function (extensionPointId, object) {},

  unregister: function (object) {},

  // Extension points are lazily created
  getExtensionPoint: function (extensionPointId) {
  },
}

// The extension point provides access to the registered extensions.
// Access to the extension points are only through the plugins.extensions.getExtensionPoint(id).
// Depending on security, access to the extension point may need to be validated with the manifest.
var ExtensionPoint = {
  // an up-to-date view of the contributed extensions
  get object () {},

  // boolean all. if false, show only active 
  // this allows an overlay to implement registry wide, per extension point UI preferences.
  get array () {},
  
  // At the point of running a method, the extensions stored in extensions as Object and Array
  // may be only the metadata added by the manifest.
  
  // ((extension) => void):
  onAdd: function (onAdd) {},

  // ((extension) => void):
  onRemove: function (onRemove) {},

  removeListener: function (listener) {},
};