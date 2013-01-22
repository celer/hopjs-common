var utils = require('../index.js');
var path = require('path');

utils.startExample(path.join(__dirname,"../examples/express"),{ port:3050 },function(err,example){	
	process.stdout.on("data",console.log);
	if(!err && example){	
		setTimeout(function(){
			example.stop(function(){
				process.exit();
			});
		},20*1000);
	}
});
