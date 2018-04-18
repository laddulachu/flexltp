# Powwow Server Common

v5 - Node phantom simple now built-in (since it needed too many patches).
     Screenconfig has been removed.  Now directlty using screen ids.
v4 - Single Selectors now check if node is visible before returning it.  This can be changed by adding { "selectHidden": true }
v3 - Uses node-phantom-simple wrapper and PhantomJS 2.1.1.

Note: Due to this bug in node-phantom-simple: https://github.com/baudehlo/node-phantom-simple/issues/132 - you will need to patch bridge.js before 'onClosing' handlers will work.

This module provides the following functionality:

- Page Models
- Page API
- Websocket RPC API

## The main application that includes this module should provide

### config.json - Contains start URL for app and logging settings.

## In api/index.js

Requires for all the state files, which have

- States registration based on URL patterns and # of frames loaded
- API calls for state actions.

## In inject/index.json

A JSON array containing list of files to inject.  These get injected after "common.js".

- Field page models and any app specific field types.


## What is this?

_Node Module for helping with Web Page transformation_

Handles the following:

1) Managing the websocket session

2) Screen management (screen and subscreens, reconnect...)
   - subscreens are for tracking different client side pages.

3) Getting events and passing them to into the main application
  - Page Loaded event
     - All states are checked for matching URLs.
     - Dealing with multi frame page loads, can count frames.

  - Resource loaded event.
     - These are good to know because when a click makes a XHR request,
       waiting for the XHR response is better than a timer.  We can then look
       for specific DOM mutations.

  - DOM mutation events
     - These will tell us when the DOM has changed in the background.

4) Injecting common Javascript into the page context
  - Code for clicking nodes, getting text, etc.
  - General code for reading and setting data on the page based on the field page model.
  - Field page models handle single fields as well as tables and lists.

This also contains a test page to kickstart testing of the API.

## INFO

Use test.html to connect to the server and test it out.

Call "export ENV=development" to have the server start on port 3000.

The "util" built-in class has some useful methods:

- util.getData - Takes a page model as the main parameter and returns the data that matches it

- util.setData - Takes a page model and some data and calls the setters.  Format of input is {"pageModel": pageModel, "values": values}
- util.callAction - Takes a page model and the item ID of the action to perform (i.e. clicks a button or link or submits a form.)  Format of input is {"descriptor": descriptor, "action": itemId}

All 3 calls above accept either a JSON page model object or a descriptor that is a string.  If it's a string, it's assumed that it's defined in the injected JS.

setData and callAction take a "item id" which is a path to the item in the JSON represented as a string.  E.g. for this data:

{
  "myData" {
    "mySubData": "something",
    "myArray" : [
      { "arrayItem" : "a thing", "arrayItem2": 123 },
      { "arrayItem" : "another thing", "arrayItem2": 456 }
    ]
  }
}

The item ids are:

- "myData.mySubData"
- "myData.myArray[0].arrayItem"
- "myData.myArray[0].arrayItem2"
- "myData.myArray[1].arrayItem"
- "myData.myArray[1].arrayItem2"

- util.setSubScreen - Takes a { state: "screen", subscreen: "subscreen"} object and changes the subscreen.  Use this for navigation between subscreens so that the server knows the current subscreen.
- util.snapshot - Take a screenshot of the page and returns the filename.

