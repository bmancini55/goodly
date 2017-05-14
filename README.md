# goodly

[![Build Status][travis-image]][travis-url]
[![Coverage Status][coveralls-image]][coveralls-url]

Goodly is an unopininated microservice communication framework. It manages the low-level queing so you can focus on the important stuff: handling events.

Goodly has several design goals:

1. Create a simple programming interface for event-based microservices.
2. Support scale-out of individual services -> add more instances of the service and work will automatically be distributed between the instances.
3. Support addition of new services -> add as many services as you need.
4. Supports large-event transmission between services -> send data through the broker, http, tcp, udp, protocol buffers, etc.

Goodly doesn't tell you the best way to structure you app, it gives you a set of tools and lets you build on-top of RabbitMQ.  Goodly manages the AMQP exchange creation, queue creation, and messaging routing creation. It does all this to provide a simple interface for building your application that will automatically scale.

## Made for coding

How easy it is to use? Create a service in a few lines of code...

```javascript
import goodly from 'goodly';

const service = goodly({ name: 'documents' });

// start the service
service.start({ brokerPath: 'ampq://192.168.99.100' });

// listen for an event and do something
service.on('document.uploaded', async ({ data, emit }) => {
  // do something with the data
  let document = await saveDocumentAsync(data);
  // emit another event
  emit('document.available', document);
});
```

With the above code, you could start a single instance or 1000 instances. The work will be distributed between your instances automatically.


## API

### Service Methods

* __Promise start({ brokerPath, concurrent)__
  
  Starts the service and if necessary creates all exchange and queues owned by the service.  Once start is complete, the service will immeidately begin pulling work from the service queue.
  
  Parameters:
  * __string brokerPath__ - host of RabbitMQ
  * __int concurrent__ - the number of open messages that will be concurrent consumed  
  
* __Promise stop()__

  stops the service and disconnects from RabbitMQ

* __Promise emit(path, data, options)__

  Emits a message with the specified path and data. Emit does not expect a response and is equivalent to pub/sub actions.
  
  Paramters:
  * __string path__ - name of the event to send
  * __any data__ - the data that will be send that could be a buffer, string, int, float, bool, array, object, or error
  
* __Promise request(path, data)__

  Makes a request with the specified path and data. Request will block until a response is received.
  
  Paramters:
  * __string path__ - name of the event to send
  * __any data__ - the data that will be send that could be a buffer, string, int, float, bool, array, object, or error
  
* __Promise on(path, fn1, fn2, ...)__
 
   Adds a handler to the service for supplied path. The supplied functions will be executed in order of attachment.
   
   Parameters:
   * __string path__ - name of the event to listen for
   * __fn handler__ - a handler for the event
   
 ### Handler
 
Handlers are called with an `Event` object. The `Event` object contains several methods and pieces of data:

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
