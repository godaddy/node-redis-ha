var redisha = require("../redis-ha");

var client = redisha.createClient(6379);
client.addClient(6380);

setInterval(function() {

	var v = parseInt(Math.random() * 100000);
	var k = "redis-ha/tests/timer_test.js";

	client.set(k, v, function(err) {
		if (err) {
			console.log("SET ERR: " + k);
			console.dir(err.stack || err);
		} else {
			client.get(k, function (err, gv) {
				if (err) {
					console.log("GET ERR: " + k);
					console.dir(err.stack || err);
				} else if (gv != v) {
					console.log("GET ERR: " + k);
					console.dir("(Inconsistent values)");
				} else {
					console.log("all ok");
				}
			});
		}
	});

}, 1000);