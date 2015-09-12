'use strict';
let test = require('tap').test

let registry = require('../lib/registry')
let Registry = registry.Registry, 
    createAddons = registry.createAddons

test('manifest loaded, maybe', (t) => {
  let registry = new Registry()
  // let addons = createAddons(registry)
  // addons.load('test-addon-1/manifest.json')
  //   .then((addon) => {
  //     t.ok(addon, 'Something came back') 
  //     t.end()
  //   })
  t.end()
})