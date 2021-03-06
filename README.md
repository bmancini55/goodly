# goodly

[![Build Status][travis-image]][travis-url]
[![Coverage Status][coveralls-image]][coveralls-url]

Goodly is a simple microservice framework that uses RabbitMQ. It has a few design goals to make working events pleasant:

1. Provide a simple programming interface for handling and emitting events
2. Allow extensibility through middleware
3. Perform common eventing patterns with no fuss:
    1. Services can to subscribe to any events (pub/sub)
    2. Services scale out by starting another instance (work queues)
    3. Direct connection between services (rpc)

## Getting Started

Using Node.js 7.6+, you can easily create a service with a few lines of code.

```
npm install goodly
```

```javascript
// import goodly
const goodly  = require('goodly');

// create the service
const service = goodly('ping');

// listen for an event and attach a handler
service.on('pong', handlePong);

async function handlePong({ data, emit }) {
  console.log(`received a pong event with message: ${data.message}`);
  await emit('ping', { message: 'ping' });
}

// start the service by attaching to a RabbitMQ instance
service.start('127.0.0.1');
```

## Overview

Goodly is simple but powerful. Here are some of the features.

_Note: for a detailed overview of how Goodly services leverage AMQP and RabbitMQ refer to [AMQP and the Goodly Spec](#amqp-and-the-goodly-spec)._

### Async/Await

Goodly makes heavy use of [`async/await`](https://developers.google.com/web/fundamentals/getting-started/primers/async-functions). This was a design descision to make writing handlers simpler.

Working with async function is simple. For example, defining a handler can be done with three techniques:

[`async function`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function)
```javascript
service.on('some-event', someEventHandler);

async function someEventHandler(event) {
  // do something
}
```

 [`async function expression`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/async_function)
 ``` javascript
service.on('some-event', async function(event) {
  // do something
});
 ```

`async lambda function`
```javascript
service.on('some-event', async (event) => {
  // do something
});
```

Because `async` functions always return a `Promise` you can swap between `async/await` and callback based code by using Promise syntax.

```javascript
function delay(next) {
  setTimeout(function() {
    service.emit('delayed').then(next);
  }, 1000);
}
```

That said, all asynchronous operations return Promises.


### Emitting Events

Events can be emitted by the service or from inside an event handlers. Emit takes the form `emit(path, payload)`.

#### Service Emits

Service emits are defined as events generated by calling the `emit` method directly on the service.

Emitting events from the service is a great way to start an event chain. The only requirement for emitting events from the service is that the service needs to be started.

When an event is emitted by the service, it will generate a new correlation Id that is attached to the event. This is a useful way to track a series events through all of the handlers.

A few practical examples of where emitting events directly from the service can be useful...

##### Express HTTP request

This example demonstrates how Express or another HTTP framework can form an API-Gateway. Requests are made to the gateway over HTTP and Goodly emits events to perform various actions.

```javascript
const express = require('express');
const goodly  = require('goodly');

// create and start the service
let service = goodly('api-gateway');
service.start('127.0.0.1');

// define the express application
let app = express();
app.post('/login', (req, res, next) => postLogin(req, res).catch(next));

// defined an async HTTP handler
async function postLogin(req, res) {

  // do some stuff
  // let user = doSomething(req);

  // emit that the user has logged in
  await service.emit('user.login.complete', user);

  res.send(user);
}
```

##### Timer

This example demonstrates how a timer can be used to emit events periodically.

```javascript
const goodly  = require('goodly');
const service = goodly('timer');

service.start('127.0.0.1');

setInternal(function() {
  service
    .emit('timer.ticked', Date.now)
    .catch(console.error);
}, 60000);
```

#### Handler emits

Handler emitted events are the other type of event emission. These events are triggered by the `emit` method on the event object.

This is a special `emit` method that automatically includes the correlation Id from the handled event. This provides a handy way to chain events together and track them via the correlation Id.

For example:

```javascript
const goodly = require('goodly');
const service = goodly('hello-world');

service.on('ping', async ({ emit }) => {
  await emit('pong'); // handler emit retains original correlation Id
});

service.start('127.0.0.1');
```

The above code creates a handler that is executed whenever there is a `ping` event.  The event passed into the handler includes the `emit` method that is called to emit the `pong` event.  The pong event will include the same correlation Id that was in the event event!

For example, the above method could be modifed to output the correlation Id

```javascript
const goodly = require('goodly');
const service = goodly('hello-world');

// handler with handler emit
service.on('ping', async ({ emit, correlationId }) => {
  console.log('ping', correlationId);
  await emit('pong');
});

// handler with handler emit
service.on('pong', async ({ emit, correlationId }) => {
  console.log('pong', correlationId);
  await emit('ping');
});

// start the service and emit a ping to start it off!
service
  .start('127.0.0.1')
  .then(() => service.emit('ping'));

// start it off with a service emit
service.emit('ping');
```

#### Event Payloads



### Listening to Events

With an event-based system you should be able to listen to events. Doing so is quite easy.  Events are emitted by other services.  You can easily

```javascript
const goodly = require('goodly');

// import required code for email handler
const emailProcessor = require('./email-processor');


const emailService = goodly({ name: 'email-service' });
emailService.on('order.created', async ({ data: order, emit }) => {
  await emailProcessor.sendEmail(order);
  await emit('order.emailsent');
});

const inventoryService = goodly({ name: 'inventory-service' });
inventoryService.on('order.created', async({ data, emit }) => {
  console.log('placeholder
});

```

#### Event Pattern Matching

### Request / Response



### Middleware

#### Inbound

#### Outbound


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

## AMQP and the Goodly Spec

### Exchanges and Queues

### Message Serialization

### Future Porting


[travis-image]: https://travis-ci.org/bmancini55/goodly.svg?branch=master
[travis-url]: https://travis-ci.org/bmancini55/goodly
[coveralls-image]: https://coveralls.io/repos/github/bmancini55/goodly/badge.svg?branch=master
[coveralls-url]: https://coveralls.io/github/bmancini55/goodly?branch=master
