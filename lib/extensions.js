// Compo extensions are not necessary for the working of the registry, 
// but are the necessary reflection glue that allows lazy loading to happen

class Extension {
  constructor (location, metadata) {
    this._location = location
    this._metadata = metadata
  }


}