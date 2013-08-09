# redis-ha

High availability Redis Client.


## Install

	npm install redis-ha


## Usage

Works 99% identical to redis client, in fact it relies on redis client to do all of the heavy lifting.

	var redisha = require("redis-ha");
	var client = redisha.createClient(); // works identical to redis client
	client.addClient(6380); // this is unique to redis-ha
	client.set("magic!", "magic", function() {
	  client.get("magic!", function(err, val) {
	    console.log("magic " + ((val === "magic") ? "===" : "!==") + "magic");
	  });
	});

## Testing

Spin up two instances of Redis locally, on ports 6379 (master) and 6380 (slave), and make sure the slave is configured to allow writes.

	node tests/timer_test.js
	
or

	node tests/brute_force.js

* Take down the master, see it switch over instantly without fail
* Take down the slave, see how even under worst case it can fail but handle gracefully
* Bring slave back up, and see how fast it auto recovers
* Bring master back up, and see how the master takes over once again


## Documentation

Custom methods include:

addClient - Works identical to redis client's createClient, except it adds the client to the current RedisHAClient instance.

	var haclient = redisha.createClient();
	haclient.addClient(6380);

RedisHAClient - Allows you to manage multiple instances of Redis High-Availability.
 
	var RedisHAClient = redisha.RedisHAClient;
	var client1 = new RedisHAClient();
	client1.addClient(6379);
	var client2 = new RedisHAClient();
	client2.addClient(6380);
	// want to share nodes too? No problem
	var client3 = new RedisHAClient();
	client3.addClient(6379);
	client3.addClient(6380);

Otherwise, all commands are identical to the redis client: https://github.com/mranney/node_redis
