TODO
----
Add __dirname interpolation to plugin.inflate() [done]
Rename plugin -> plugin, everywhere. [done]
autostart: true - depends on lazyloading extension points
  - cheap fix is to load extensions when extensionPoint is accessed for the first time
    - still ask user to 
  - run the module after loading the manifests 
(main has to be started before an extension has been loaded)
lazy loading of extensions

let foo = {}
Object.defineProperty(foo, 'foo.bar', {set: function (v) { this._value = v } })


built-in extension points
  - manifest parsers; there is almost certainly going to require calculating or specifying a startup order.
    - extension validators / permission checkers. ('In order to use that, you'll need the `system` permission')
    - syntactic sugar for additional manifest attributes (rpgML)
  - extension transforms – decorating one extension with another. 

testing tools --> management tools --> automation tools --> packaging tools

Keep ExtensionPointAPI _backingArray in ExtensionPoint; maintain a seperate ExtensionPointAPI for each plugin
 - each API has its own event emitter – for better memory management in unload().
 - plugins shouldn't compete to configure the EP
ExtensionPointsAPI should be Object.freeze()

Crawl through devDependencies on load, looking for other plugins

i.e. the plugin developer can just do npm install, but deployers can just use npm install --production

plugin.directoryWatcher extension point. Watches a particular directory for new plugins and changes in plugins.
  npm install --production

console println should be replaced with output

output
  log
  println
  error
  prompt()

output.prompt(string, (string) => finished)
  - conversational interface builder!


private singletons. Sorts out lots of lifecycle bugs.

Errors thrown in onAdd should cause the extension not to be added, or removed.

Extensions should not be cached on path – because the extension may have different metadata.



