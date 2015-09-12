'use strict';
let test = require('tap').test

let ExtensionPoint = require('../lib/extension-points').ExtensionPoint

test('Registration events, extension point established before extensions', (t) => {
  let id = 'mozilla.test.extensionPoint'
  let ep = new ExtensionPoint(id)

  let api = ep.api;
  t.ok(api, 'api defined?')

  let count = 0
  api.onAdd((extension) => {
    t.ok(extension, 'extension defined onAdd')
    count ++
  })
  api.onRemove((extension) => {
    t.ok(extension, 'extension defined onRemove')
    count --
  })

  // these could be anything.
  const E1 = 'extension1',
    E2 = 'extension2'

  ep.registerExtension(E1)
  t.equal(1, count, 'number of extensions in the extension point')

  ep.registerExtension(E2)
  t.equal(2, count, 'number of extensions in the extension point')  

  ep.unregisterExtension(E1)
  t.equal(1, count, 'number of extensions in the extension point')
  ep.unregisterExtension(E2)
  t.equal(0, count, 'number of extensions in the extension point')
  t.end()
})

test('Registration events, extension point established after extensions', (t) => {
  let id = 'mozilla.test.extensionPoint'
  let ep = new ExtensionPoint(id)

  let api = ep.api;
  t.ok(api, 'api defined?')

  // these could be anything.
  const E1 = 'extension1',
    E2 = 'extension2'

  ep.registerExtension(E1)
  ep.registerExtension(E2)

  let count = 0
  api.onAdd((extension) => {
    t.ok(extension, 'onAdd ' + extension) 
    count ++
  })
  api.onRemove((extension) => {
    t.ok(extension, 'onRemove ' + extension)
    count --
  })

  t.equal(2, count, 'number of extensions in the extension point')  

  t.end()
})

let createExtension = (_id) => {
  return {_id}
}

test('Views, as array and as object', (t) => {
  let id = 'mozilla.test.extensionPoint'
  let ep = new ExtensionPoint(id),
      api = ep.api

  const E1 = createExtension('extension1'),
        E2 = createExtension('extension2')

  ep.registerExtension(E1)
  t.deepEqual(api.extensionsArrayView(), [E1])
  t.deepEqual(api.extensionsObjectView(), {
    'extension1': E1,
  })

  ep.registerExtension(E2)
  t.deepEqual(api.extensionsArrayView(), [E1, E2])
  t.deepEqual(api.extensionsObjectView(), {
    'extension1': E1,
    'extension2': E2,
  })

  ep.unregisterExtension(E1)
  t.deepEqual(api.extensionsArrayView(), [E2])
  t.deepEqual(api.extensionsObjectView(), {
    'extension2': E2,
  })
  t.end()
})

