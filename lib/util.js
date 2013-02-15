var path = require('path');
var Stream = require('stream');
var cp = require('child_process');
var net = require('net');
var fs = require('fs');
var assert = require('assert');

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
	var encodeFunc=function(object,path){
		if(object===null){
			return "";
		} else if(object instanceof Array){
			for(var i in object){
				var value = object[i];
				var pp=(path==undefined?"[]":path+"[]");
				var ret = encodeFunc(value,pp);
				if(ret!=undefined){
					form.append(pp,ret);
				}
			}
			return undefined;
		} else if(object instanceof Object){
			
			for(var i in object){
				var value = object[i];	
				var pp=(path==undefined?i:path+"["+i+"]");;
				var ret = encodeFunc(value,i);
				if(ret!=undefined){
					form.append(pp,ret);
				}
			}
			return undefined;
		} else if(typeof Stream!="undefined" && object instanceof Stream){
			return object;
		} else if(typeof Buffer!="undefined" && object instanceof Buffer){
			return object;
		} else if(typeof Blob!="undefined" && object instanceof Blob){
			return object;
		} else if(typeof File!="undefined" && object instanceof File){
			return object;
		} else if(typeof object=="string" || typeof object=="number" || typeof object=="boolean") {
			return object.toString();
		}
	}
	encodeFunc(object,path);
}


var testForm = function(){
	var TestForm = function(){
	}
	TestForm.prototype.append=function(p,v){
		if(typeof this[p]!="undefined"){
			if(this[p] instanceof Array){
				this[p].push(v);
			} else {
				var t=this[p];
				this[p]=[];
				this[p].push(t);
				this[p].push(v);
			}
		} else {
			this[p]=v;
		}
	}
	
	var values = [ 
		{ input: { a: true, b:"hello"}, expected: { a: "true",b:"hello"}},
		{ input: { array: [1,2,3,4,5], b:{ a: 1, b:2, c:3 } }, expected: {"array[]":["1","2","3","4","5"],"b[a]":"1","b[b]":"2","b[c]":"3"}},
		{ input: { array: [1,2,3,4,5], b:{ a: 1, b:2, c:3 } }, expected: {"array[]":["1","2","3","4","5"],"b[a]":"1","b[b]":"2","b[c]":"3"}},
		{ input: { b:{ a: 1,d:["a",1,3,true,false,["F",1],{a:true, b:false}] } }, expected: {"b[a]":"1","d[]":["a","1","3","true","false"],"d[][]":["F","1"],"d[][a]":"true","d[][b]":"false"}},
		{ input: [ { a: 1} , {b:2, c:"false"}], expected:{"[][a]":"1","[][b]":"2","[][c]":"false"}}
	];

	values.map(function(inputs){
		var tf = new TestForm();
		exports.appendForm(tf,inputs.input,undefined);
		assert.deepEqual(tf,inputs.expected);
	});

};

testForm();
delete testForm;


exports.requireOnDemand=function(packages,onComplete){
	var installed=0;
	var failed=0;
	packages.map(function(pkg){
		if(!fs.existsSync(path.join("node_modules",pkg))){
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
		} else {
			installed++;
			if((installed+failed)==packages.length){
				if(failed==0)
					return onComplete(null,true);
				else return onComplete("Failed to install packages");
			}
		}	
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

	var env = JSON.parse(JSON.stringify(process.env));
	
	
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
			proc = cp.execFile("node",["app.js"],{ cwd:dir, env: env });
	
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



