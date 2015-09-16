
t.ok(true, 'External objects are available, and can vm can call methods')
t.ok(JSON, 'JSON is available')
t.ok(console, 'console is available')
t.ok(setTimeout, 'setTimeout is available')
addon.increment(2)
let addonFlag

addon.setter = function (x) {
  this.state.flag = x
  this.flag = x
  addonFlag = x
}

addon.getter = () => addonFlag