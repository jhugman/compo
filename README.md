Compo
=====
`compo` is a plugin-system for node.js apps.

`compo`'s principle job is to automate the wiring between code within different plugins.

This allows you to get on with writing the interesting code you want to, instead of plumbing of it all together.

`compo` apps are composed of cooperating plugins. `compo` can also be used as a bolt-on plugin system for existing apps.

Plugins may be added or removed at runtime.

It is written in ES6, to be initially run on node 4.0.

All the features of `compo` are optional, but to get the benefits a certain style of writing code becomes more natural.

There's a play-along-at-home demo at https://github.com/jhugman/compo-contrib-demo .

Nomenclature
------------
I have taken the eclipse naming convention of `extensionPoints`. The corresponding `extensions` is a natural fit with extension points, however I'm aware of the confusion with Chrome Extensions.

In eclipse land (and `compo`) Plugins are the container and unit of distribution, extension points gather contributions from other plugins. Extensions are those contributions.

Addons, extension points, extenders could also work.

OSGi's Bundle, Service, ServiceProvider don't work for me, at all.

Design Goals
------------

* make it easy to make a feature of a plugin extensible, with extension points
* make it very easy for others to contribute to those features, with extensions
* plugins (and thus features) can be loaded and unloaded at runtime
* plugins are easily auditable, and access to other code is limited to what they ask for
  - this is for human reviewers, but has benefits for
    - packaging tools
    - static analysis tools
    - instrumentation tools
* security – make it (at least) hard for plugins to abuse or interfere with one another, or the `compo` plugin manager itself.
* plugin lifecycles are deterministic, but driven by and through `compo`.
* compo's existing manifest footprint should be small, so as to be embeddable in other manifests.

Design Choices
--------------

* Don't fight with npm; a plugin a specialised npm module. The plugin is the unit of distribution. The distribution mechanism is npm.
* No build steps; code is run in place, require is node's require within a plugin, and `compo` wires the plugins together. `compo` is written in the node v4.0 variant of ES6.
* Follow the Eclipse naming convention of plugins, extension points and extensions. 
* Make it easy to evolve the manifest format
  - to be more or less powerful than its base state
  - to implement other manifest properties in terms of `compo` primitives.

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
The `extensions` property of the manifest should define an array of extension objects.

Extensions have a mandatory `epID` property, which stands for extension point ID. This should be a string matching the id of the extension point that this extension contributes to.

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

Point to two functions in `./lib/counter`:

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

Within the `main` module itself, the `plugin` object won't be available until after first run. If `plugin` is needed at startup, then that logic should be delayed, e.g. wrapped in a `setTimeout()`. #ugly.

```javascript
setTimeout(() => {
  let plugin = exports.plugin
}, 1)
``` 

Observations about developing with compo
========================================
While writing a game (text-adventure), and instrumenting it (graphviz maps of the gameworld and the plugins) I've made a few observations:

 - Enabling easy use of the extension point makes it incredibly easy to make very sophisticated and extendable plugins, which can be composed by the user at runtime.
 - Moving wiring into the `compo` manifest means much little or no wiring code is written, making refactoring very easy.
 - In this respect, `compo` behaves like a variant of a dependency injector.
 - There is a move from code to configuration (bugs can happen in config), however: the learning curve starts with contributing extensions to other plugins. This lets new developers see the fruit of their labour very quickly.
 - Less code written means fewer bugs, easier to test. 
 - The simplicity of the javascript interface means it is extremely easy to mock out the rest of the app when testing.
 - Bootstrapping an extension point is easy, but choosing which extension points is a naming problem i.e. NP complete. It's hard to find the right name, but you know you've found the right one when you've found it.

Some patterns
-------------
'Application' plugins only need define a handful of extension points to be very powerful.
e.g.

  - a game might have a 'game.room', 'game.item', 'game.spell' and 'game.spell.word'.
  - a wallet might have 'wallet.currency.converter', 'wallet.provider.transfer', 'wallet.initialize'

'Extender' plugins need only define extensions to existing extension points.

  - Toronto office Mozilla game plugin.
  - Mt Gox wallet plugin.

UI is handled by lower level plugins – `compo-contrib-server` and `compo-contrib-console`, which themselves define extension points.

Instrumentation, debug and admin plugins use singletons published by application plugins. 

The `pluginManager` itself is available as a permission, so this applies to the running instance of the `pluginManager`. This means admin UI for addons/plugins install, lifecycle, configuration, is relatively easy to build.

Prefs (much more important in client side application) can be implemented and instrumented in a single place, and provided to other addons as a service. Plugin specific prefs UI can be generated. This means prefs UI can be exposed and presented nicely with very little effort by the plugin developer.

Fully functioned application plugins can offer 'delighter' extensions that may lie dormant until the consumer plugin is installed. e.g. Lightbeam plugin may offer a `content.blocker` extension; training may be delivered via an extension to the game.

The manifest parsing and normalizing is itself extensible with `compo.manifest.transform`, so specialized permission logic, and implementing the additional manifest properties in terms of extensions, or restricting what the plugin can do are all possible here.

Conclusion
==========
`compo` is a relatively simple but full-featured way of composing applications from small re-useable components. It builds on npm and node's `require`, but could be adapted for use in browser addons.

I am uncertain if this style will catch on with people write node apps: at server-side the concept of plugins is a little strange; building your app out of plugins sounds a bit Drupal-ish to some or of benefit to large scale projects.

"Architecture lets you build bigger things"
------------------------------------------

The concepts of extension points, and sharing-through-manifests are worth pursuing. These would most benefit much smaller non-communicating teams which is typical of client-side, and browser add-on ecosystems.

