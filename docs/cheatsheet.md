`compo` Cheatsheet
==================
`Compo` is a plugin system. You can add it to your own apps so your own apps can accept plugins, or you can build your app from scratch as a set of collaborating plugins.

```
MyPlugin
+- package.json
+- compo.json
+- lib
  +- extensions.js
+- index.js
```

Contributing an extension to another plugin
-------------------------------------------
Extensions are declared in the plugin manifest file (a.k.a. `compo.json`) as a list of objects with an extension point id property `epID` (Syntactic sugar will change this). The extension point id is an opaque string.

All other properties are extension-point specific.

```
{
  …

  "extensions": [
    {
      "epID": "the-extension-point",

    }
  ],
  …
}

```

Extensions can be represent anything a JSON object can represent.

Regular Javascript objects and functions can be extensions. The manifest JSON can have a `object` or `function` property, to point to and object or function that is the extension.

```
{
  …

  "extensions": [
    {
      "epID": "http.endpoint",
      "function": "./lib/endpoints!getHello",
      "path": "/hello/:user",
      "method": "get"
    }
  ],
  …
}
```

The value of the `function` or `object` property is in two parts: a Common JS module path relative to the plugin's directory, and dotted property path. The two are separated by a exclamation mark ('!').

```
exports.getHello = (req, res) => {
  
}
```

The property path starts at `exports` looking up each successive property as it goes.

```
exports.foo = { 
  bar: { 
    baz: (req, res) => {}
  }
}
```

If the property path passes through a constructor function, a new instance is created, and can be used by other extensions.

```
exports.Counter = class {
  constructor () {
    this._count = 0
  }

  increment () {
    this._count ++
  }

  decrement () {
    this._count --
  }

  get count () {
    return this._count
  }
}

Accessing the `plugin` object
---------------------------
The `plugin` object is how you consume other plugins' extensions. Each plugin gets its own object, based on what was asked for in the manifest (`compo.js`).

It is the object that has `permissions` added to it when you ask for them.

It is the object that has the `extensionPoints` lookup on it.

The `plugin` object is put on the `exports` object of the main (e.g. `index.js`) module.

In your extension code, e.g. `extension.js`, finding the `plugin` object is simple.

```
let plugin = require('..').plugin

```

If your plugin has code in `index.js` which you want to the `plugin` object (for example if you wish to have it run on startup), accessing the plugin object should be deferred – either until point of use, or with a timeout.

```
setTimeout(() => {
  let plugin = exports.plugin
}, 1)
```


