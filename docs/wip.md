TODO
----
Add __dirname interpolation to addon.inflate()
Rename addon -> plugin, everywhere.
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


testing tools --> management tools --> automation tools --> packaging tools
