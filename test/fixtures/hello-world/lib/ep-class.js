let count = 0

module.exports = class {
  constructor () {
    this.count = count ++
  }
  
  method1 () {
    return this.count
  }

  //
  method2 () {
    return this.count
  }
}