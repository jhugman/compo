'use strict'
let test = require('tap').test

function createExtension (id) {
  return { _id: id }
}

let compo = require('../lib/registry.js')

test('Registry access, no checking', (t) => {
  let Registry = compo.Registry
  let r = new Registry()

  let epid = 'mozilla.test.extensionPoint'

  const E1 = createExtension('E1'),
        E2 = createExtension('E2')

  r.register(epid, E1)
  r.register(epid, E2)

  let ep = r.getExtensionPoint(epid)
  t.deepEqual(ep.extensionsArrayView(), [E1, E2], 'extension point resolves ok')
  t.end()
})