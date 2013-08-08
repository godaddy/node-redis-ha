var
	redis = require("redis"),
	extend = require("extend"),
	util = require("util"),
	events = require("events"),
	HACommands = require("./lib/ha-commands"),
	BasicCommands = require("./lib/basic-commands"),
	defaultClient = null
;

exports.RedisHAClient = RedisHAClient;
exports.createClient = createClient;

/* NOT backward compatible with redis
*/
function RedisHAClient(options) {
	this.options = options || {};
	
	this.clients = [];
	
	events.EventEmitter.call(this);
}
util.inherits(RedisHAClient, events.EventEmitter);

/* Mostly backward compatible with redis implementations
	IMPORTANT: First client is assumed to be MASTER
*/
function createClient(port_arg, host_arg, options) {
	var haclient;
	if (!defaultClient) { // only create a new HAClient if one does not already exist
		haclient = new RedisHAClient(options);
		defaultClient = haclient;
	}
	haclient.addClient.apply(haclient, arguments);

	// return redis-like redis-ha client
	return haclient;
}

function onError(err) {
	//console.log("redis-ha.redis.onError", inspect(err.stack || err, { depth: null }));
}

var p = RedisHAClient.prototype;

/* Very similar to redis-ha.createClient, but this function is unique to redis-ha and allows you to add a client
   to a specific redis-ha instance.
*/
p.addClient = function() {
	var client = redis.createClient.apply(null, arguments);
	client.on("error", onError);

	this.clients.push(client);
	
	return client;
}

/* Specialized on event handler. Subscribe on all clients, but ignore all events from inactive clients
*/
p.on = function(name, cb) {
	var i, c;
	for (i = 0; i < this.clients.length; i++) {
		c = this.clients[i];
		c.on(name, getClientCallback("on", this, c, cb));
	}
}

function getClientCallback(cmd, haclient, originalClient, cb) {
	return function() {
		var args = arguments;
//console.log("redis-ha.getClientCallback.callback", util.inspect(args));
		haclient.getActiveClient(function(client) {
			if (client.connection_id != originalClient.connection_id) {
				// the command came from a non-active client, ignore
				return;
			}

			cb && cb.apply(null, args);
		});
	};
}

/* Typically should be master, but could be any client
*/
p.getActiveClient = function(cb) {
	var i, c;
	// always use the first available client (master preferably)
	for (i = 0; i < this.clients.length; i++) {
		c = this.clients[i];
		if (c.ready) {
			cb(c);
			return;
		}
	}

	// delay before callback to prevent stack overflow potential
	var $this = this;
	setTimeout(function() {
		cb.apply($this, null);
	}, 1000);
}

/* init prototype */

var i, c;

// for HA commands, provide fallback wrapper that will retry against all clients before failing
for (i = 0; i < HACommands.length; i++) {
	c = HACommands[i];
	p[c] = createHACommand(c);
}

// for BASIC commands, provide fallback wrapper that will retry against all clients before failing
for (i = 0; i < BasicCommands.length; i++) {
	c = BasicCommands[i];
	p[c] = createBasicCommand(c);
}

function createHACommand(cmd) {
	var redisHAFunc = function() {
		// this = RedisHAClient instance
//console.log("redis-ha.command." + cmd, util.inspect(arguments));
		var $this = this, args = [], i, origArguments = arguments;
		for (i = 0; i < arguments.length; i++) {
			args.push(origArguments[i]);// copy, do not use original
		}
		var origCb = args[arguments.length - 1];
		var cb = function(err) {
			if (err) {
//console.log("redis-ha.command." + cmd + " FAILED. Trying new client");
				// client.active SHOULD be false, but lets not modify it anyway
				// try again, using a new client
				redisHAFunc.apply($this, origArguments);
				return;
			} else if (typeof origCb === "function") {
//console.log("redis-ha.command." + cmd + " SUCCESS. Calling CB now", util.inspect(arguments));
				origCb.apply(null, arguments); // now we can invoke the original callback
			}
		};
		if (typeof origCb === "function") { // replace with our callback
			args[arguments.length - 1] = cb;
		} else { // otherwise append our callback
			args.push(cb);
		}
		
		this.getActiveClient(function(client) {
			if (!client) { // if not client available, throw error
				origCb.apply(null, new Error("No redis client available"));
				return;
			}
//console.log("redis-ha.getActiveClient OK. Invoking command now: " + cmd + " on connection_id: " + client.connection_id);
			client.send_anyway = false; // we won't to make sure commands are not queued
			client[cmd].apply(client, args); // call redis command
		});
	};
	
	return redisHAFunc;
}

function createBasicCommand(cmd) {
	var redisFunc = function() {
		// this = RedisHAClient instance
//console.log("redis-ha.command." + cmd, util.inspect(arguments));
		var $this = this, args = [], i, c, origArguments = arguments;
		for (i = 0; i < arguments.length; i++) {
			args.push(origArguments[i]);// copy, do not use original
		}
		var origCb = args[arguments.length - 1];
		var firstResponse = true;
		var cb = function(err) {
			if (firstResponse === false) {
				return; // only the first response is permitted
			}
			firstResponse = false; // prevent subsequent client callbacks from also calling back

			if (err) {
//console.log("redis-ha.command." + cmd + " FAILED. Trying new client");
				// client.active SHOULD be false, but lets not modify it anyway
				// try again, using a new client
				redisFunc.apply($this, origArguments);
				return;
			} else if (typeof origCb === "function") {
//console.log("redis-ha.command." + cmd + " SUCCESS. Calling CB now", util.inspect(arguments));
				origCb.apply(null, arguments); // now we can invoke the original callback
			}
		};
		if (typeof origCb === "function") { // replace with our callback
			args[arguments.length - 1] = cb;
		} else { // otherwise append our callback
			args.push(cb);
		}

		// invoke the command on all clients, not just the active one
		for (i = 0; i < this.clients.length; i++) {
			c = this.clients[i];
			c.send_anyway = false; // we won't to make sure commands are not queued
			c[cmd].apply(c, args); // call redis command
		}
	};
	
	return redisFunc;
}
