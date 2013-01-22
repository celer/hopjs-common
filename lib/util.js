var path = require('path');
var Stream = require('stream');
var cp = require('child_process');
var net = require('net');

var webpath = {};

//joining process for URL's, on windows will replace backslashes with forward.
webpath.join = function(){
	var pathArgs = [];
	
	for(var i in arguments){
		pathArgs.push(arguments[i]);		
	}
	var ret = path.join.apply(null,pathArgs);
	if(path.sep == "\\"){
		ret=ret.replace(/\\/g, "/");
	}
	return ret;
};
exports.webpath = webpath;


exports.appendForm=function(form,object,path){
	var hasData=false;
	form=form|| { append:function(){}};
	for(var i in object){
		var v = object[i];
		var p = i;
		if(typeof path!="undefined"){
			p=path+'['+p+']';
		}
		if(v===null){
			form.append(p,"");
			hasData=true;
		} else if(typeof Stream!="undefined" && v instanceof Stream){
			form.append(p,v);
			hasData=true;
		} else if(typeof Buffer!="undefined" && v instanceof Buffer){
			form.append(p,v);
			hasData=true;
		} else if(typeof Blob!="undefined" && v instanceof Blob){
			form.append(p,v);
			hasData=true;
		} else if(typeof File!="undefined" && v instanceof File){
			form.append(p,v);
			hasData=true;
		} else if(typeof v=="object"){
			hasData=exports.appendForm(form,v,p);	
		} else if(typeof v!="undefined"){
			form.append(p,v.toString());
			hasData=true;
		}
	}
	return hasData;
}


exports.requireOnDemand=function(packages,onComplete){
	var installed=0;
	var failed=0;
	packages.map(function(pkg){
		var proc = cp.exec("npm install "+pkg);
		proc.on('exit',function(errCode){
			if(errCode==0){
				installed++;
			} else {
				console.warn("Failed to install package ",pkg);
				failed++;
			}
			if((installed+failed)==packages.length){
				if(failed==0)
					return onComplete(null,true);
				else return onComplete("Failed to install packages");
			}
		});	
	});


}

exports.startExample=function(exampleName,options,onComplete){
	if(typeof options=="function"){
		onComplete=options;
		options=null;
	}

	options=options||{};
	var port = options.port || 3000;
	var sslport = options.sslport || 3443;

	var env = {};
	
	
	if(port!=null)
		env.PORT=port;
	if(sslport!=null)
		env.SSLPORT=port;

	
	var dir = exampleName;

	var proc=cp.exec("(cd "+dir+" && npm install .)");
	//proc.stdout.on("data",console.log);
	//proc.stderr.on("data",console.log);
	
	proc.on("exit",function(errCode){
		if(errCode==0){
			var startTime = Date.now();
			proc = cp.exec("node app.js",{ cwd:dir, env: env });
	
			proc.stop=function(onComplete){
				onComplete=onComplete||function(){};
				proc.on('exit',function(){
					onComplete();
				});
				proc.kill();	
				setTimeout(function(){
					proc.kill('SIGKILL');
				},200);
			}
	
			if(options.port!=null){	
				var waitForStart=function(onDone){
					try {
						var client = net.connect({ port: port});
						if((Date.now()-startTime) > 10*1000){
							return onDone(null,false);
						}
						client.on("timeout",function(){
							setTimeout(function(){ waitForStart(onDone); },500);
							client.end();
						});
						client.on("error",function(){
							setTimeout(function(){ waitForStart(onDone); },500);
							client.end();
						});
						client.on("connect",function(){
							client.end();	
							return onDone(null,true);
						});
					} catch (e){
						onDone(null,false);
					}
				}
				waitForStart(function(err,res){
					onComplete(null,proc);
				});
			} else {
				onComplete(null,proc);
			}
		} else { 
			return onComplete("Failed to install example dependencies");
		}
	});

}



