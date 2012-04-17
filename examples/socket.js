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

var io = require('socket.io').listen(3002);

io.sockets.on('connection', function(socket) {
	socket.on('start', function(data, callback) {
		console.info('Starting MSN...');
		
		var msn = require('../lib/msn').msn;
		
		// Login to the server
		msn.login(data.passport, data.password);
		msn.setIOSocket(socket);

		// User states
		var contacts = {};
		msn.on("user_change_status", function(user, status) {
			contacts[user] = {status: status};
		});

		msn.on("user_online", function(user) {
			contacts[user] = {status: "Avalible"};
		});

		msn.on("user_offline", function(user) {
			if(contacts[user]) {
				contacts[user].status = "Offline";
			}
		});

		// Contact list
		msn.on('contact_add', function(user) {
			contacts[user] = {status: "Avalible"};
		});

        socket.on('getcontacts', function(data, fn) {
			fn(contacts);
		});

		socket.on('send', function(data, fn) {
			msn.send(data.sessionid, data.message);
		});
		
		socket.on('opensession', function(data, fn){
			msn.opensession(data.email, fn);
		});
		
		msn.on('ready', function() {
			// Inform the client!
			callback();
		});
	});
});

