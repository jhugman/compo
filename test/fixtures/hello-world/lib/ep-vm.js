
t.ok(true, 'External objects are available, and can vm can call methods')
t.ok(JSON, 'JSON is available')
t.ok(console, 'console is available')
t.ok(setTimeout, 'setTimeout is available')
plugin.increment(2)
let pluginFlag

plugin.setter = function (x) {
  this.state.flag = x
  this.flag = x
  pluginFlag = x
}

plugin.getter = () => pluginFlag