
Example usage
-------------

compo-console plugin provides: 
  - interactive console
  - extension points for console command 'console.command'.
  - console.command: 'help'

compo-mgmt
  - management of plugins console
  - load/unload whole plugins
  - list extension points (all, by plugin)
  - list extensions (all, by plugin, by extension point)

compo-server plugin provides:
  - http server
  - extension points for listening to routes
  - extension points for common pages (login, error, loggedOut, home)
  - console: list routes
  - extension points for routes to serve directories

compo-prefs plugin provides:
  - unified persistent prefs
  - extension point for defaults.
  - console for setting getting and listing prefs.

compo-events plugin provides:
  - eventBus singleton.

A fun example
-------------
compo-rpg
  - offers extension points for
    - rooms - { gridRef, exits, }
    - player items: { location, description }
    - player commands: { userInLocation, userNearItem, userHasItem: }
    - player events: { eventName, userNearItem, userHasItem }
  - singleton createUser()
    - username
    - inventory
    - 
