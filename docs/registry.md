The extension registry
======================

The primary data structure in the extension registry is the `ExtensionPoint`.

The extension point is a set of extensions. Users of extension point can get a view on that set of extensions:

```
let ep = plugin.extensionPoints['my.extension']
ep.key = 'type'

let all = ep.array
let dictionary = ep.object     // keyed by `type`
let idToList = ep.objectGroups // keyed by `type`

let listOfExtensions = ep.objectGroups[chosenType]
let extension = ep.object[chosenType]
```

If consumers get these views as close to use as possible, then they will always have an up-to-date view of the registry.

Sometime this isn't possible and you want to configure something bigger that the plugins:

```


```