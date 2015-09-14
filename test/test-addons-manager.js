'use strict';
let test = require('tap').test,
    path = require('path')


let Registry = require('../lib/registry').Registry, 
    AddonManager = require('../lib/addons-manager').AddonManager

test('manifest loaded, maybe', (t) => {
  let registry = new Registry()
  let addons = new AddonManager(registry, path.join(__dirname, 'fixtures'))
  //t.ok(addons)

  let loadAddon = addons.load('./hello-world')

  t.ok(loadAddon, 'loading an addon returns something')
  t.ok(loadAddon.then, 'it looks like a promise')

  loadAddon
    .then((addon) => {
      t.ok(addon, 'addon exists')
      t.ok(addon.hasOwnProperty('notAvailable'), 'addon is allowed notAvailable, even if it is not available')
      t.notOk(addon.hasOwnProperty('notAllowed'), 'addon has no access to a singleton not requested in the manifest')
      
      t.ok(addon.hasOwnProperty('epTester'), 'addon has epTester allowed')
      t.equal(addon.epTester.prop1, 'yes', 'addon has epTester from manifest')
      
      t.throws(() => {
        // has asked for permission, but no singleton was available
        let singleton = addon.notAvailable
      })
      t.end()
    })
    .catch((err) => {
      console.log('ERROR ', err)
      t.fail()
    })
})