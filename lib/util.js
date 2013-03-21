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


exports.DataEncoder=function(form){ 
	var self=this;
		
	var qs=[];

	var urlEncoder={
		append:function(name,value){
			qs.push([encodeURIComponent(name)+"="+encodeURIComponent(value)]);
		}
	};

	form=form||urlEncoder;

	this._json=true;
	this._form=true;
	this._hasData=false;
	this.encode=function(object){
		var encodeFunc=function(object,path){
			if(object===null){
				return "";
			} else if(object instanceof Date){
				return object.toString();
			} else if(typeof Stream!="undefined" && object instanceof Stream){
				self._json=false;	
				return object;
			} else if(typeof Buffer!="undefined" && object instanceof Buffer){
				console.log("BBB");
				self._json=false;	
				return object;
			} else if(typeof Blob!="undefined" && object instanceof Blob){
				self._json=false;	
				return object;
			} else if(typeof File!="undefined" && object instanceof File){
				self._json=false;	
				return object;
			} else if(object instanceof Array){
				for(var i in object){
					var value = object[i];
					var pp=null;
					if(path==undefined){
						pp="";
					} else {
						pp=path+"";
						var ret = encodeFunc(value,pp);
						if(ret!=undefined){
							form.append(pp,ret);
							self._hasData=true;
						} else {
							self._form=false;
						}
					}	
				}
				return undefined;
			} else if(object instanceof Object){
				for(var i in object){
					var value = object[i];	
					var pp=(path==undefined?i:path+"["+i+"]");
					var ret = encodeFunc(value,pp);
					if(ret!=undefined){
						form.append(pp,ret);
						self._hasData=true;
					}
				}
				return undefined;
			} else if(typeof object=="string" || typeof object=="number" || typeof object=="boolean") {
				return object.toString();
			}
		}
		encodeFunc(object);
		return self._hasData;
	}
	this.toJSON=function(object){
		return JSON.stringify(object);
	}
	this.hasData=function(){
		return self._hasData;
	}
	this.canEncodeAsForm=function(){
		return self._form;
	}
	this.canEncodeAsJSON=function(){
		return self._json;
	}
	this.toQueryString=function(){
		return qs.join("&");
	}	
	
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
	

	var d = new Date();
	
	var values = [ 
	{"input":{"a":false,"b":"hello"},"expected":{"a":"false","b":"hello"},"form":true,"json":true,"qs":"a=false&b=hello"},
	{"input":{"array":[1,2,3],"obj":{"a":1,"b":"2","c":false}},"expected":{"array":["1","2","3"],"obj[a]":"1","obj[b]":"2","obj[c]":"false"},"form":true,"json":true,"qs":"array=1&array=2&array=3&obj%5Ba%5D=1&obj%5Bb%5D=2&obj%5Bc%5D=false"},
	{"input":{"array":[{"a":[1]},[2],[3]]},"expected":{"array[a]":"1","array":["2","3"]},"form":false,"json":true,"qs":"array%5Ba%5D=1&array=2&array=3"},
	{"input":{"float":3.43},"expected":{"float":"3.43"},"form":true,"json":true,"qs":"float=3.43"},
	{"input":{"a":{"b":{"a":1,"b":"1","c":{"d":"X"}}}},"expected":{"a[b][a]":"1","a[b][b]":"1","a[b][c][d]":"X"},"form":true,"json":true,"qs":"a%5Bb%5D%5Ba%5D=1&a%5Bb%5D%5Bb%5D=1&a%5Bb%5D%5Bc%5D%5Bd%5D=X"},
	];

	values.map(function(inputs){
		var tf = new TestForm();

		var f = new exports.DataEncoder();
		f.encode(inputs.input);
		var qs = f.toQueryString();

		var f = new exports.DataEncoder(tf);
		f.encode(inputs.input);
		assert.deepEqual(tf,inputs.expected);
		assert.equal(f.canEncodeAsJSON(),inputs.json);
		assert.equal(f.canEncodeAsForm(),inputs.form);
		assert.equal(qs,inputs.qs);
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



