var API = {
  // 'extensions' are registered and unregistered with an extension point.
  // The 'extensionPointId' is provided by another developer. If the developer 
  // documents it somewhere, then other people can use it.
  // 'extensions' are objects specified by the extension point.
  register: function (extensionPointId, object) {},

  // extensions can be lazily loaded (so as not to impact initial load time)
  // This method would be used by the manifest parser.
  registerMetadata: function (extensionPointId, metadata, plugin) {}, 


  unregister: function (object) {},

  // Extension points are lazily created
  // The credentials validated against the manifest
  getExtensionPoint: function (extensionPointId, credentials) {
    var ep = this._registry[extensionPointId];
    if (!ep) {
      ep = new ExtensionPoint(extensionPointId);
      ep._credentials = credentials;
      this._registry[extensionPointId] = ep;
    } else if (ep._credentials !== credentials) {
      // this catches the cases:
      // a) a manifest registers an existing extension point
      // b) an plugin is trying to access extensions it has not indicated in the manifest

      throw new Error(
        'Unauthorized access to extension point ' + extensionPointId + 
        ' with credentials ' + credentials
      );
    } else {
      // does not catch:
      // a) 'gazumped' extension points. PluginA will always get access first, and PluginB will fail to load the extension point.

    }
    return ep;
  },

  // This should take the json as given by the manifest (and thence to the consumer of the extension point)
  // It should return a promise 
  resolveCallable: function (metadata) {

    // we have already resolved the plugin.
    var callables = metadata._callables;
    if (callables) {
      return new Promise().resolve(callables);
    }

    var saved = function(callables) {
      metadata._callables = callables;
      return callables;
    };
    if (metadata.jsCtx !== this.jsCtx) {
      // this is an opportunity to build bridges
      // as long as callable returns
      // a) void or  
      // b) a promise
      // we can wrap this
      return wrapRemote(metadata).then(saved);
    }

    var activatorUri = metadata.activator;
    var evaled = fetch(activatorUri)
      .then(function (data) {
        // We can put this in any context we want.
        var callables = eval(data);
        return callables;
      });

    return evaled.then(saved);
  },
};

// The extension point provides access to the registered extensions.
// Access to the extension points are only through the plugins.extensions.getExtensionPoint(id).
// Depending on security, access to the extension point may need to be validated with the manifest.
var ExtensionPoint = {
  // an up-to-date view of the contributed extensions
  extensionsAsObject: function (all) {},

  // boolean all. if false, show only active 
  // this allows an overlay to implement registry wide, per extension point UI preferences.
  extensionsAsArray: function (all) {},
  
  // At the point of running a method, the extensions stored in extensions as Object and Array
  // may be only the metadata added by the manifest.
  
  // ((extension) => void):
  onAdd: function (onAdd) {},

  // ((extension) => void):
  onRemove: function (onRemove) {},

  removeListener: function (listener) {},

  reset: function () {},
};



var CRED = Math.random();
var ep;
var PluginsImpl = {
  onLoad: function () {
    ep = plugins.registry.getExtensionPoint('mozilla.firefox.plugins', CRED);
    ep.onAdd(this.onAddPlugin);
  },

  onAddPlugin: function (plugin) {
    var ctx = {
      credentials: Math.random(),
    };

    manifests.parseManifest(plugin, ctx);
    this._postLoad(plugin, ctx);
  },

  _postLoad: function (plugin, ctx) {
    plugins.registry.resolveCallable(plugin)
      .then(function (plugin) {
        plugin.onLoad(ctx);
      });
  },

  onRemovePlugin: function (plugin) {
    if (plugin.onUnload) {
      plugin.onUnload(ctx);
    }
  },

  onUnload: function () {

  },
};

PluginsImpl.onLoad();

Plugins = {
  install: function (url) {
  // async load {
    plugins.registry.register('mozilla.firefox.plugins', {
      onLoad: (ctx) => {},
      onUnload: (ctx) => {},
    });
  //}
  },
}

var Manifests = {
  parseManifest: function (plugin, ctx, cb) {
    var json = {}; // …
    var extensions = json.extensions;

    // you want to do recursive install, don't you.

    _.each(extensions, function (i, key) {
      var metadata = extensions[key];
      registry.registerMetadata(key, metadata);  
    });
    
    var extensionPoints = json.extensionPoints;

    _.each(extensionPoints, function (i, epid) {
      // 
    });

  },
};