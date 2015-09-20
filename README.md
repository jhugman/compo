Compo
=====
`compo`'s principle job is to automate the wiring between code within different plugins.

This allows you to get on with writing the interesting code you want to, instead of plumbing of it all together.

`compo` is a plugin-system for node.js apps. 

`compo` apps are composed of cooperating plugins. 

Plugins may be added or removed at runtime.

It is written in ES6, to be initially run on node 4.0.

All the features of `compo` are optional, but to get the benefits a certain style of writing code becomes more natural.

I am uncertain if this style is enough to change the way people write node apps.

Design principles
-----------------
You write your application as a set of plugins

It tries to stay in the background so as to do just enough to be really helpful, but not enough to get in your way. It's just another anti-framework framework.

* make it easy to accept contributions to other plugins
* make it easy to make contributions to other plugins
* plugins can be loaded and unloaded at runtime
* plugins should be auditable, and access to other code is limited to what they ask for
* code-reuse is easy
* Don't fight with npm.

Implementation principles
-------------------------
* No build steps
* Promises are preferred async method. Without other guidance accept synchrony but propogate asychrony.


High level view
---------------
Define a unit of extension. For a plugin that consumes those extensions, the type (a JSON object, a js object or function) and format of extension is important, but for the purpose this discussion, it is not.

The set of extensions a plugin has collected for it is an extension point. The extension point can provide views onto this set (an object or grouped object) and `events` and `remove` events.

