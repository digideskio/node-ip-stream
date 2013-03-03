// Copyright (c) 2013, Benjamin J. Kelly ("Author")
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice, this
//    list of conditions and the following disclaimer.
// 2. Redistributions in binary form must reproduce the above copyright notice,
//    this list of conditions and the following disclaimer in the documentation
//    and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
// ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

'use strict';

var IpStream = require('../stream');

var IpHeader = require('ip-header');

module.exports.buffer = function(test) {
  test.expect(2);

  var iph = new IpHeader({
    src: '1.1.1.1',
    dst: '2.2.2.2',
    protocol: 'udp',
    dataLength: 58
  });

  var ipstream = new IpStream();
  ipstream.on('readable', function() {
    var msg = ipstream.read();
    test.deepEqual(iph, msg.ip);
    test.ok(msg.data instanceof Buffer);
  });
  ipstream.on('end', function() {
    test.done();
  });
  ipstream.read(0);

  ipstream.write(iph.toBuffer());
  ipstream.end();
};

module.exports.object = function(test) {
  test.expect(2);

  var iph = new IpHeader({
    src: '1.1.1.1',
    dst: '2.2.2.2',
    protocol: 'udp',
    dataLength: 58
  });

  var ipstream = new IpStream();
  ipstream.on('readable', function() {
    var msg = ipstream.read();
    test.deepEqual(iph, msg.ip);
    test.ok(msg.data instanceof Buffer);
  });
  ipstream.on('end', function() {
    test.done();
  });
  ipstream.read(0);

  ipstream.write({ data: iph.toBuffer(), offset: 0, ether: { type: 'ip' } });
  ipstream.end();
};

module.exports.ignore = function(test) {
  test.expect(1);

  var value = {
    data: new Buffer(50),
    offset: 0,
    ether: { type: 'arp' }
  };

  var ipstream = new IpStream();
  ipstream.on('ignored', function(error, msg) {
    test.deepEqual(value, msg);
  });
  ipstream.on('readable', function() {
    var msg = ipstream.read();
    test.ok(!msg);
  });
  ipstream.on('end', function() {
    test.done();
  });
  ipstream.read(0);

  ipstream.write(value);
  ipstream.end();
};
