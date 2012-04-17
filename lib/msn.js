/**
 *  The MIT License
 *  
 *  Copyright (c) 2012 Emiel van Goor
 *  
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the "Software"), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *  
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *  
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

function urlencode(str) {
	return escape(str).replace('+', '%2B').replace('%20', '+').replace('*', '%2A').replace('/', '%2F').replace('@', '%40');
}

var configuration = {
	server : {
		url : "messenger.hotmail.com",
		port: 1863
	},
	
	credentials : {
		email : "",
		url_email : "",
		password: ""
	}
};

var msn = {
	login : function(passport, password) {
		configuration.credentials.email = passport;
		configuration.credentials.url_email = urlencode(passport);
		configuration.credentials.password = password;
		
		// Start!!
		start();
	},
	
	logout : function() {
		Notification.write("OUT\r\n");
		this._event("logout");
	},
	
	opensession : function(passport, callback) {
		Notification.write("XFR " + (num++) + " SB\r\n");
		var cData = function(d) {
			var response = parseResponse(d),
				parts = response.raw.split(" ");

			switch(response.command) {
				case "XFR":
					var command = response.prop.split(" ");
					var server = command[1].split(":");
					var sb = new SB;
					sb.create(server[0], server[1], command[3], passport, callback);
					
					// Remove this listener
					Notification.removeListener('data', cData);
					break;
			}
		};
		
		// Add the listener
		Notification.on('data', cData);
	},
	
	send: function(SBId, message) {
		var instance = this._getSBInstance(SBId);

		if (!instance) {
			// Chat already closed
			// @TODO request new SB session
            debug('TODO: Connection to ' + SBId + ' already closed...');
			return false;
		}
		
		instance.send(message);
	},
	
	_socket : null,
	setIOSocket : function(socket) {
		this._socket = socket;
	},
	
	/////////////////
	_listeners : [],
	on : function(event, fn, scope) {
		scope = scope || this;
		
		this._listeners.push({
			event : event,
			fn : fn,
			scope : scope
		});
	},
	
	// Trigger an event
	_event : function(event, parameters) {
		// SOCKET.IO Client connected!
		if (this._socket !== null) {
			this._socket.emit(event, parameters); 
		}
		
		for(var i =0; i != this._listeners.length; i++) {
			var e = this._listeners[i];
			
			if (e.event === event) {
				e.fn.apply(e.scope, parameters);
			}
		}
	},
	
	_SBInstances : [],
	_registerSBInstance : function(instance) {
		this._SBInstances.push(instance);
	},
	_getSBInstance : function(SBId) {
		for(var i =0; i != this._SBInstances.length; i++) {
			var e = this._SBInstances[i];
			
			if (SBId === e.securityString) {
				return e;
			}
		}
		
		return false;
	},
	_removeSBInstance : function(SBId) {
		var stack = [];
		for(var i =0; i != this._SBInstances.length; i++) {
			var e = this._SBInstances[i];
			
			if (SBId !== e.securityString) {
				stack.push(e);
			}
		}
		
		this._SBInstances = stack;
	}
};

exports.msn = msn;

var net = require("net");
var server = configuration.server;

// Debug function
var debug = function(t) {
	msn._event("debug", [t]);
}
var msg = function(t) {
	msn._event("debug", [t]);
}

var num = 1;
var command = function(conn, command, properties) {
	var comm = command + " " + (num++) + " " + properties ;
	debug("OUT: " + comm);

	conn.write(comm + "\r\n");
}

var parseResponse = function(data) {
	var chunks = data.split(" ");
	var command = chunks.shift();
	var num = chunks.shift();
	var prop = chunks.join(" ");
	
	return {
		command : command,
		num : num,
		prop : prop,
		raw : command + " " + num + " " + prop
	};
}

function createConnection(s, p, con) {
	var con = net.createConnection(p, s);
	con.setEncoding("UTF8");
	
	con.on("error", function() {
		msg("connection error");
		console.info(arguments);
	});
	
	return con;
}

function start() {
	// Create a connection
	var Notification = createConnection(server.url, server.port);

	Notification.on("connect", function() {
		command(Notification, "VER", "MSNP8 CVR0");
	});

	Notification.on('data', function(rawData) {
		var response = parseResponse(rawData);
		debug("IN: " + response.command + " " + response.num + " " + response.prop.split("\r")[0]);
		// The first 3 commands until we get the final server to connect to!
		switch(response.command) {
			case "VER":
				command(Notification, "CVR", "0x0409 win 4.10 i386 MSNMSGR 5.0.0544 MSMSGS " + configuration.credentials.email);
				break;
			case "CVR":
				command(Notification, "USR", "TWN I " + configuration.credentials.email)
				break;
			case "XFR":
				// We got a new server to connect to
				var c = response.prop.split(" ")[1].split(":"),
					s = c[0],
					p = c[1];
					
				// continue login to the given server
				loginExtended(s, p);
				break;
			default : 
				debug("----- NOT YET IMPLEMENTED -----");
				debug(response);
		}
	});
};

var user_states = {
	"NLN": "Available",
	"BSY": "Busy",
	"IDL": "Idle",
	"BRB": "Be Right Back",
	"AWY": "Away",
	"PHN": "On the Phone",
	"LUN": "Out to Lunch"
};
function loginExtended(server, port) {
	Notification = createConnection(server, port);
	
	Notification.on('connect', function() {
		msg('Connected to ' + server + ":" + port);
		command(Notification, "VER", "MSNP8 CVR0");
	})
	
	Notification.on('data', function(data) {
		var response = parseResponse(data);
		debug("IN: " + response.command + " " + response.num + " " + response.prop.split("\r")[0]);
		switch(response.command) {
			case "VER":
				command(Notification, "CVR", "0x0409 win 4.10 i386 MSNMSGR 5.0.0544 MSMSGS " + configuration.credentials.email);
				break;
			case "CVR":
				command(Notification, "USR", "TWN I " + configuration.credentials.email)
				break;
			case "USR":
				var USRcommand = response.prop.split(" ")[0];

				// We need to authenticate!
				if (USRcommand == "TWN")
				{
					//Connect to the password nexus
					var http = require('../lib/http-sync/http-sync');
					var url = require('url').parse("https://nexus.passport.com/rdr/pprdr.asp");
				
					var req = http.request({
						host: url.hostname, 
						port: url.port, 
						path: url.pathname
				    });
				    var res = req.end();
					// Try and fetch login url
					var headers = res.headers.PassportURLs.split(",");
					var loginurl = "";
					for(var i=0; i != headers.length; i++) {
						var head = headers[i].split("=");
					
						if (head[0] == "DALogin") {
							loginurl = head[1];
						}
					}
				
					// Get the tpf string
					var tpf = response.prop.split(" ")[2].split(",");
					tpf = tpf[(tpf.length-1)].split("=")[1].split("\r")[0];
				
					var	user = configuration.credentials.url_email,
						pswd = configuration.credentials.password,
						url = require('url').parse("https://login.passport.com");

					// Login and get auth token
					var request = require('request'),
					    url = "https://" + loginurl,
					    auth = "Passport1.4 OrgVerb=GET,OrgURL=http%3A%2F%2Fmessenger%2Emsn%2Ecom,sign-in="+user+",pwd="+pswd+",lc=1033,id=507,tw=40,fs=1,ru=http%3A%2F%2Fmessenger%2Emsn%2Ecom,ct=1062764229,kpp=1,kv=5,ver=2.1.0173.1,tpf=" + tpf;

					request({
					        url : url,
					        headers : {
					            "Authorization" : auth
					        }
					    },
					    function (error, response, body) {
							var authToken = response.headers["authentication-info"].split("'")[1];
							command(Notification, "USR", "TWN S " + authToken)
					    }
					);
				}
				else {
					// loaded and loggedin
					msn._event("ready");
					
					msg("------------ LOGGED IN ----------");

					// Sync user contact list
					command(Notification, "SYN", "6");
					
					// Send initial presence (going Online)
					command(Notification, "CHG", "NLN 0");
				}
				break;
				
			// Contact in list but offline
			case "LST" :
				msn._event("contact_add",[
					response.num,
					"offline"
				]);
				break;
				
			// Contact group
			case "LSG" :
				debug("Got contact group : " + response.prop.split(" ")[0]);
				break;

			case "ILN" :
				var p = response.raw.split(" ");
				msn._event("contact_add",[
					p[3]
				]);
				break;

			// Change online status of an contact
			case "NLN" :
				var p = response.raw.split(" "),
				 	s = user_states[p[1]];
				
				msn._event("user_change_status", [
					p[3],
					s || "online",
					p[1] || "online"
				]);
				break;

			// User goes offline
			case "FLN" :
				var p = response.raw.split(" ");
				msn._event("user_offline", [
					p[1]
				]);
				break;
				
			// The server is chalenging us! ARRRRRRRRW!
			case "CHL" :
//			case "CHG" :
			
				var crypto = require('crypto'),
				 	challenge = response.prop,
					md5 = crypto.createHash('md5').update(challenge + "Q1P7W2E4J9R8U3S5").digest("hex"),
					c = "QRY " + (num++) + " msmsgs@msnmsgr.com 32\\r\\n" + md5;
				
				debug("OUT: " + c );
				
				Notification.write(c);
				break;
				
			// We got a caller!!
			case "RNG":
				var p = response.prop.split(" ");
				var server = p[0].split(":");
				
				var sb = new SB;
				
				sb.recieve(server[0], server[1], p[2], response.num);
				break;
				
			// Response to our SB create request
			case "XFR":
				break;
			// Signout from messenger
			case "OUT" :
				msg("Closing connection, Bye! (Did you sign in at another location?)");
				break;
			default	: 
				debug("----- NOT YET IMPLEMENTED -----");
				debug(response);
		}
	});
}


var SB = function() {
	var installEvents = function(con, instance) {
		

		con.on('data', function(message) {
			var message = message.split("\r\n");
			debug(message);
			var	RNGCommand = message[0].split(" ");

			switch(RNGCommand[0]) {
				case "MSG":
					var m = message[6];
					if (m != "" && m !== undefined) {
						msn._event("message:received", [
							RNGCommand[2],
							message[6],
							instance.securityString
						]);
					}else
					{
						if(message[3].split(":")[0] == "TypingUser") {
							msn._event("message:typing", [
								RNGCommand[2],
								instance.securityString
							]);
						}
					}
					break;

				case "BYE":
					msn._event("message_closed", [
						instance.securityString
					]);

					debug("IDLE, Must close connection to switch board...");

					// Remove the current instance
					msn._removeSBInstance(instance.securityString);
					break;
				case "IRO":
					msg(RNGCommand[5] + "("+RNGCommand[4]+") joined the chat...");

					msn._event("message:userjoin", [
						RNGCommand[5],
						instance.securityString
					]);
					break;
			}
		});
	};
	
	var createInstance = function(con, server, port, sercurityId) {
		return {
			conn : con,
			securityString: sercurityId,
			server : server,
			port : port,
			num : 1,
			// Functions:
			send : function(msg) {
				var c = "MSG 4 U " + (msg.length + 114)+ "\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nX-MMS-IM-Format: FN=Arial; EF=I; CO=0; CS=0; PF=22\r\n\r\n" + msg;
				this.conn.write(c);
			}
		}
	};
	
	return {
		create : function(server, port, securityid, inviteuser, callback) {
			var conn = net.createConnection(port, server);
			conn.setEncoding("UTF8");

			// Create new server instance:
			var instance = createInstance(conn, server, port, securityid);
			
			conn.on('connect', function() {
				// identify myself
				setTimeout(function() {
					var c = "USR " + (instance.num++) + " " + configuration.credentials.email + " " + securityid
					debug("OUT: " + c);
					conn.write(c);
					
				}, 500)
			});
			
			var cData = function(data) {
				var cmd = data.split(" ");
				
				// identify return
				if(cmd[0] == "USR") {
					if (cmd[2] == "OK") {
						// Server say's hello!
						
						// Invite the user
						command(conn, "CAL", inviteuser);
					}
				}else if(cmd[0] == "JOI") { // The user entered the chat!
					// Remove this listener
					conn.removeListener('data', cData);
					
					// Parse events
					installEvents(conn, instance);
					
					// Invoke the callback function
					callback.apply(this, [securityid]);					
				}
			}
			conn.on('data', cData);
			
			// register the current SB
			msn._registerSBInstance(instance);
		},
		
		recieve : function(server, port, securityid, ringid) {
			var con = net.createConnection(port, server);
			con.setEncoding("UTF8");

			// Create new server instance:
			var instance = createInstance(con, server, port, securityid);
			
			con.on('connect', function() {
				// Connected to the SB
				debug("Connected to the SB");
				command(con, "ANS", configuration.credentials.email + " " + instance.securityString + " " + ringid);
			});
			
			// register the current SB
			msn._registerSBInstance(instance);
			
			// Parse events
			installEvents(con, instance);
		}
	}
}
