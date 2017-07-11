# goodly

[![Build Status][travis-image]][travis-url]
[![Coverage Status][coveralls-image]][coveralls-url]

Goodly is an unopininated microservice framework. It manages the low-level queing so you can focus building services to handle events.

Goodly has several design goals:

1. A simple programming interface for event-based microservices.
2. Easily scale-out services to distribute load.
3. Easily add new services and listen to any event.

## Getting Started

Using Node.js 7.6+, you can easily create a service.

```
npm install goodly
```

```javascript
let goodly = require('goodly');

// create the service
const service = goodly({ name: 'documents' });

// attach event listeners
// listen for an event and do something
service.on('document.uploaded', async ({ data, emit }) => {
  // do something with the data
  let document = await saveDocumentAsync(data);
  // emit another event
  emit('document.available', document);
});

// start the service
service.start({ brokerPath: 'ampq://192.168.99.100' });
```

## API

### Service Methods

* __Promise start({ brokerPath, concurrent)__
  
  Starts the service and creates all exchange and queues owned by the service. Handlers must be attached prior to starting the service. Once start is complete, the service will immeidately begin pulling work from the service queue.
  
  Parameters:
  * __string brokerPath__ - host of RabbitMQ
  * __int concurrent__ - the number of open messages that will be concurrent consumed  
  
* __Promise stop()__

  stops the service and disconnects from RabbitMQ

* __Promise emit(path, data, options)__

  Emits a message with the specified path and data. Emit does not expect a response and is equivalent to a publish actions.  The service needs to be started prior to emitting a request.
  
  Paramters:
  * __string path__ - name of the event to send
  * __any data__ - the data that will be send that could be a buffer, string, int, float, bool, array, object, or error
  
* __Promise request(path, data)__

  Makes a request with the specified path and data. Request will block until a response is received.  The service must be started prior to emitting a request.
  
  Paramters:
  * __string path__ - name of the event to send
  * __any data__ - the data that will be send that could be a buffer, string, int, float, bool, array, object, or error
  
* __void on(path, fn1, fn2, ...)__
 
   Adds a handler to the service for supplied path. The supplied functions will be executed in order of attachment.
   
   Parameters:
   * __string path__ - name of the event to listen for
   * __fn handler__ - a handler for the event  

* __void use(path, args)__
  
  Adds middleware function for modifying in-bound or out-bound events.  The path is optional, and if not supplied will attach the middleware to all event.
  
  Parameters:
  * __string path__ - optional path to attach middleware to
  * __object|function args__ - function for inbound middleware or an object with properties `in` and `out` for attaching a function to in-bound and out-bound events.
   
 ### Handler
 
Handlers are called with an `Event` object as the first argument and `next` function as the second argument.  Using `next` allows middleware to pass control to the next layer of middleware and await it's completion.

For example:

```
service.use(async function (event, next) {
  console.log('recieved an event');
  await next();
  console.log('processed event successfully';
}
```

The `Event` object contains several methods and pieces of data:

Properties:

* __any data__ - the data that will be send that could be a buffer, string, int, float, bool, array, object, or error
* __correlationId__ - the UUID mapping to a unique origin event
* __msg__ - the raw RabbitMQ message

Methods:

* __emit__ - calls the emit method on the service but uses the supplied correlationId for the incoming event
* __reply__ - replys to a message that is a Request/Response message 



[travis-image]: https://travis-ci.org/bmancini55/goodly.svg?branch=master
[travis-url]: https://travis-ci.org/bmancini55/goodly
[coveralls-image]: https://coveralls.io/repos/github/bmancini55/goodly/badge.svg?branch=master
[coveralls-url]: https://coveralls.io/github/bmancini55/goodly?branch=master
