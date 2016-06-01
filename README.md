# goodly

[![Build Status][travis-image]][travis-url]
[![Coverage Status][coveralls-image]][coveralls-url]

Goodly is an unopininated microservice communication framework. It manages the low-level infrastructure so you can focus on the important stuff: handling events.

Goodly:

1. Has a simple programming interface for event-based microservices
1. Supports scale-out of individual services
1. Supports addition of new service types
1. Supports large-message transmission between services
1. Supports automatic routing of messaging through a central communication bus

Conceptually, it fills a similiar role that Express does for web application development, except in the event-based microservice world. Goodly doesn't tell you the best way to structure you app, it gives you a set of tools and lets you build on-top.

Goodly manages the AMQP exchange creation, queue creation, and messaging routing creation. It does all this to provide a simple interface for building your application but with the added benefit of allowing scale-out of your services.

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


## Getting Started

Refer to the full example at https://www.github.com/bmancini55/goodly-example.

## API




[travis-image]: https://travis-ci.org/bmancini55/goodly.svg?branch=master
[travis-url]: https://travis-ci.org/bmancini55/goodly
[coveralls-image]: https://coveralls.io/repos/github/bmancini55/goodly/badge.svg?branch=master
[coveralls-url]: https://coveralls.io/github/bmancini55/goodly?branch=master