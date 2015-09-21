'use strict'
let test = require('tap').test

function createExtension (id) {
  return { _id: id }
}

let compo = require('../lib/registry.js')

test('Registry access, no checking', (t) => {
  let Registry = compo.Registry
  let r = new Registry()

  let epid = 'compo.test.extensionPoint'

  const E1 = createExtension('E1'),
        E2 = createExtension('E2')

  r.register(epid, E1)
  r.register(epid, E2)

  let ep = r.getExtensionPoint(epid)
  t.ok(ep, 'Extension point comes back from registry')
  t.deepEqual(ep.array, [E1, E2], 'Extensions resolves ok')

  r.unregister(epid, E2)
  t.deepEqual(ep.array, [E1], 'Extensions can be removed')
  t.end()
})