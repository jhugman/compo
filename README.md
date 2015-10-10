Compo
=====
`compo` is a plugin-system for node.js apps.

`compo`'s principle job is to automate the wiring between code within different plugins.

This allows you to get on with writing the interesting code you want to, instead of plumbing of it all together.

`compo` apps are composed of cooperating plugins. `compo` can also be used as a bolt-on plugin system for existing apps.

Plugins may be added or removed at runtime.

It is written in ES6, to be initially run on node 4.0.

All the features of `compo` are optional, but to get the benefits a certain style of writing code becomes more natural.

I am uncertain if this style is enough to change the way people write node apps.

Design Goals
------------

* make it easy to make a feature of a plugin extensible, with extension points
* make it very easy for others to contribute to those features, with extensions
* features can be loaded and unloaded at runtime
* plugins are easily auditable, and access to other code is limited to what they ask for
  - this is both for human reviewers
  - packaging tools
  - static analysis tools
* security – make it (at least) hard for plugins to abuse or interfere with one another, or the `compo` plugin manager itself.
* plugin lifecycles are deterministic, but driven by and through `compo`.

Design Choices
--------------

* Don't fight with npm; a plugin based on an npm module. The plugin is the unit of distribution. The distribution mechanism is npm.
* No build steps; code is run in place, require is node's require within a plugin, and `compo` wires the plugins together.
* Follow the Eclipse naming convention of plugins, extension points and extensions. 
* Make it easy to evolve the manifest format, to be more or less powerful than its base state

Compo plugins
=============
`compo` plugins are npm modules, with a manifest.

The path to the manifest file is defined as the `compo` property in the module's `package.json`.

The manifest is a JSON file, with four optional properties:

* `extensions` are how the plugin contributes data and javascript to other plugins.
* `extensionPoints` are how the plugin collects extensions from other plugins.
* `singletons` are a convenient way for the plugin to publish singleton objects to other plugins.
* `permissions` are the way to consume singleton objects from other plugins.

Extensions and singletons in the manifest are simple snippets of JSON.

Contributing extensions
-----------------------
The `extensions` property of the manifest should define an array of extension objects. `compo` 

Extensions have a mandatory `epID` property, which stands for extension point ID. This should be a string matching the id of the extension point that this extension matches. [#ugly]()

```json
{
  "extensions": [
    {
      "epID": "console.command"
      …
    }
  ]
}
```

The extension can point to an object or function within the plugin.

`compo` looks for a `function` or `object` property for a `require`able path.


```json
{
  "extensions": [
    {
      "epID": "console.command"
      "function": "./lib/hello-world-command",
      "firstWord": "hello"
    }
  ]
}
```

The rest of the extension properties are exposed to extension points, but otherwise ignored by `compo`.

The manifest has stated that the `exports` object of `./lib/hello-world-command` is a function.

```javascript
module.exports = function (tokens, output) {
  output.info('Hello ' + tokens[0])
}
```

`compo` can look inside the `exports` of the `require`d module to find the code, by using an `!` and naming the property on the `exports` object.

```json
{
  "extensions": [
    {
      "epID": "console.command"
      "function": "./lib/console!hello",
      "firstWord": "hello"
    }
  ]
}
```

The corresponding javascript may look like:

```javascript
module.exports = {
  hello: function (tokens, output) {
    output.info('Hello ' + tokens[0])
  },
}
```

`compo` can construct new instances of classes if it detects a function but expects an object.

The new instance is cached for future extensions.

```json
{
  "extensions": [
    {
      "epID": "console.command"
      "function": "./lib/counter!increment",
      "firstWord": "inc"
    },
    {
      "epID": "console.command"
      "function": "./lib/counter!increment",
      "firstWord": "dec"
    }
  ]
}
```

```javascript
module.exports = class Counter {
  constructor () {
    this.counter = 0
  }

  increment (tokens, output) {
    this.counter ++
    output.info('Counter is now ' + this.counter)
  }

  decrement (tokens, output) {
    this.counter --
    output.info('Counter is now ' + this.counter)
  }
}
```

References to functions or objects can be defined as dotted paths.

The above example rewritten to have use an instance method on an Counter object defined in `./lib/console`.

```json
{
  "extensions": [
    {
      "epID": "console.command"
      "function": "./lib/console!Counter.increment",
      "firstWord": "inc"
    },
    {
      "epID": "console.command"
      "function": "./lib/console!Counter.decrement",
      "firstWord": "dec"
    }
  ]
}
```

In `./lib/console.js`
```javascript
class Counter {
  constructor () {
    this.counter = 0
  }

  increment (tokens, output) {
    this.counter ++
    output.info('Counter is now ' + this.counter)
  }

  decrement (tokens, output) {
    this.counter --
    output.info('Counter is now ' + this.counter)
  }
}

exports.Counter = Counter
```

Consuming extensions
--------------------
A plugin can consume extensions with extension points.

An extension point is a set of extensions.

```javascript
let ep = plugin.extensionPoints['console.command']

ep.array.forEach((command) => {
  if (firstWord === command.firstWord) {
    command(tokens, output)
  }
})
```

A plugin must declare which extension points it is going to use in the manifest. Using an extension point without declaring it will result in an error.

The extension point can provide a few common ways of viewing the extensions currently registered.

These are `array`, `object` and `objectGroups` (an object of string to list of extensions).

For `object` and `objectGroups` the extension point can be configured in the manifest.

```json
{
  "extensionPoints": {
    "console.command": {
      "key": "firstWord"
    }
  }
}
```

The above example consuming `console.command` extensions with and `object` view of the extension pint.

```
let ep = plugin.extensionPoints['console.command']

let command = ep.object[firstWord]
if (command) {
  command(tokens, output)
}

```

An extension point can listen for new extensions being added or removed.

In this way, larger datastructures can be kept in sync with what extensions have been contributed.

```javascript
let ep = plugin.extensionPoints['rpg.room']

ep.onAdd((room) => {
  map.add(room)
})
```

When the `onAdd` method is called, the listener is called once for each extension that has already been contributed.

Thus, new plugins can be loaded without restarting the app.

`compo` can use an `onRemove` listener, so plugins can be unloaded without restarting the app.

```javascript
ep.onRemove((room) => {
  map.remove(room)
})
```

Exposing singletons
-------------------
Singletons are objects, functions or constructors, made available to other plugins.

The `singletons` property in the manifest is an object mapping singleton names to extension objects.

```json
{
  "singletons": {
    "gameMap": {
      "object": "./lib/map-manager!Map"
    },
    "Room": {
      "function": "./lib/map-manager!Room"
    }
  }
}
```

Plugins need to ask for permission to access singletons.

Asking for permissions
----------------------
The `permissions` property is a list of strings. These define singleton objects that can be accessed through 
the `plugin` object.

```json
{
  "permissions": [
    "gameMap"
  ]
}
```

```javascript
let gameMap = plugin.gameMap

gameMap.nextRoom(roomId, direction)
```

If the permission is not asked for in the manifest, an `undefined` is returned. 

If a permission has been asked for, but the singleton hasn't been contributed when it is used, then it will error. To be sure that a singleton has been loaded, `plugin.consoleParser` should not be cached.

Accessing the `plugin` object
-----------------------------
Ideally, the `plugin` object should behave within a plugin accessible from the global.

However, the current implementation does not use any sandboxing that would make this possible.

For objects that come from extensions or singletons, the `plugin` object is exposed on the plugin's `main`. #ugly

In `./lib/console.js` for example:

```javascript
let plugin = require('..').plugin 
```

Within the `main` module itself, the `plugin` object won't be available until after first run. If `plugin` is needed at startup, then that logic should be wrapped in a `setTimeout()`.

```javascript
setTimeout(() => {
  let plugin = exports.plugin
}, 1)
``` 

