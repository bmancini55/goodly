#Http Transport Exchange

What makes Goodly different from a standard implementation of RabbitMQ is that data is not actually transmitted through RabbitMQ. Instead direct communication is made through HTTP requests between individaul service nodes. RabbitMQ becomes a messaging bus and not a tranmission vehicle.

This is an example of a service with multiple instances emitting an event that two other services care about.
![alt Rabbit](https://s3.amazonaws.com/goodly/design/goodly-transmission.png)

This communication mechanism means that any service can request data for an event (as both B and C do in this example).  If all data requests went back to the original Service A instance, it could create a network bottleneck on that machine. The transmission of data requets events into Service A's queue, means that the data requests are handled in round robin thus preventing bottlenecks for any given machine.
