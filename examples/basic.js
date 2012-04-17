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

var client = require('../lib/msn.js').msn
  , ansi = require('ansi')
  , cursor = ansi(process.stdout)


var term = {
    out : function(m) {
        cursor.reset().grey().write(m).reset();
    }

    ,success : function(m) {
        cursor.reset().green().write(m).reset();
    }

    ,debug : function(m) {
        cursor.reset().grey().write(m).reset();
    }

    ,print : function(m) {
        cursor.reset().write(m);
    }
}

// Login
client.login('your_passport', 'your_password');

client.on('debug', function(t) {
    term.debug(t + '\n');

});

term.out('Connecting...');

client.on('ready', function() {
    term.success('OK\n');
    

    client.on('message:typing', function(from, sessionid) {
        term.out(from + ' typing...\n');
    });

    client.on('message:received', function(from, message, sessionid) {
        term.out(from + ': ');
        term.print(message + '\n');

        // Responed
        client.send(sessionid, "Ola, " + from + ", thanks for that lovely message...");
    });
})
