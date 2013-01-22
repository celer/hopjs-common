var utils = require('../index.js');

utils.requireOnDemand(["npm","colorx"],function(err,res){
	console.log(err,res);
});
