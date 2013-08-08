var redisha = require("../redis-ha");

var client = redisha.createClient(6379);
client.addClient(6380);

var consistent = 0, inconsistent = 0, failures = 0;

function bruteForce() {

	var v = parseInt(Math.random() * 100000);
	var k = "redis-ha/tests/brute_force.js";

	client.set(k, v, function(err) {
		if (err) {
			failures++;
			bruteForce();
		} else {
			client.get(k, function (err, gv) {
				if (err) {
					failures++;
				} else if (gv != v) {
					inconsistent++;
				} else {
					consistent++;
				}
				bruteForce();
			});
		}
	});

}

bruteForce();

setInterval(function() {
	console.log("success = " + consistent + ", inconsistent = " + inconsistent + ", failures = " + failures);
}, 1000);