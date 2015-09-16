let addon = require('..').addon

let obj = {
  correctlySetThis: function () {
    return this === obj
  }
}

exports.aFunction = (x) => {
  // if the context is correctly set, then the number goes 
  // up, if not, it goes down. 
  // i.e. 
  // we see round tripping of input and output
  // we see if 'this' is set correctly
  exports.thisIsCorrectlySet = true
  let ourSettingOfThis = (this === exports)
  let isThisSetCorrectly = (ourSettingOfThis === obj.correctlySetThis())
  let increment = isThisSetCorrectly ? 1 : -1
  return x + increment
}

exports.aObject = {
  aMethod: (state) => {
    return state.count ++
  }
}

exports.AConstructor = class {
  getter () {
    return this._value
  }

  setter (v) {
    this._value = v
  }

  aMethod (who) {
    return 'hello ' + who
  }
}