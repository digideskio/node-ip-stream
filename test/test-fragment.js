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

module.exports.inOrder = function(test) {
  _doTest(test, function(ipstream, msgs) {
    ipstream.write(msgs[0]);
    ipstream.write(msgs[1]);
    ipstream.write(msgs[2]);
  });
};

module.exports.reverseOrder = function(test) {
  _doTest(test, function(ipstream, msgs) {
    ipstream.write(msgs[2]);
    ipstream.write(msgs[1]);
    ipstream.write(msgs[0]);
  });
};

module.exports.randomOrder = function(test) {
  _doTest(test, function(ipstream, msgs) {
    ipstream.write(msgs[2]);
    ipstream.write(msgs[0]);
    ipstream.write(msgs[1]);
  });
};

module.exports.timeout = function(test) {
  test.expect(2);

  var buf = new Buffer(1200);
  for (var i = 0, n = buf.length; i < n; ++i) {
    buf.writeUInt8(i & 0xff, i);
  }
  var msgs = _makeFragments(buf);

  var ipstream = new IpStream({fragmentTimeout: 100});

  ipstream.on('ignored', function(msg) {
    if (!msg.ip.offset) {
      test.deepEqual(msgs[0], msg);
    } else {
      test.deepEqual(msgs[1], msg);
      test.done();
    }
  });

  ipstream.write(msgs[0]);
  ipstream.write(msgs[1]);
};

module.exports.pass = function(test) {
  test.expect(3);

  var buf = new Buffer(1200);
  for (var i = 0, n = buf.length; i < n; ++i) {
    buf.writeUInt8(i & 0xff, i);
  }
  var msgs = _makeFragments(buf);

  var ipstream = new IpStream({fragments: 'pass'});

  var i = 0;
  ipstream.on('readable', function() {
    var msg = ipstream.read();
    test.deepEqual(msgs[i], msg);
    i += 1;
  });

  ipstream.on('end', function() {
    test.done();
  });

  ipstream.read(0);

  ipstream.write(msgs[0]);
  ipstream.write(msgs[1]);
  ipstream.write(msgs[2]);
  ipstream.end();
};

module.exports.drop = function(test) {
  test.expect(3);

  var buf = new Buffer(1200);
  for (var i = 0, n = buf.length; i < n; ++i) {
    buf.writeUInt8(i & 0xff, i);
  }
  var msgs = _makeFragments(buf);

  var ipstream = new IpStream({fragments: 'drop'});

  var i = 0;
  ipstream.on('ignored', function(msg) {
    test.deepEqual(msgs[i], msg);
    i += 1;
  });

  ipstream.on('end', function() {
    test.done();
  });

  ipstream.read(0);

  ipstream.write(msgs[0]);
  ipstream.write(msgs[1]);
  ipstream.write(msgs[2]);
  ipstream.end();
};

function _doTest(test, callback) {
  test.expect(1202);

  var buf = new Buffer(1200);
  for (var i = 0, n = buf.length; i < n; ++i) {
    buf.writeUInt8(i & 0xff, i);
  }
  var msgs = _makeFragments(buf);

  var ipstream = new IpStream();

  ipstream.on('readable', function() {
    var msg = ipstream.read();
    test.equal(1200, msg.ip.dataLength);
    test.equal(1200, msg.data.length);
    for (var i = 0; i < msg.data.length; ++i) {
      test.equal(buf[i], msg.data[i], 'byte [' + i + ']');
    }
  });

  ipstream.on('end', function() {
    test.done();
  });

  ipstream.read(0);

  callback(ipstream, msgs);

  ipstream.end();
};

function _makeFragments(buf) {
  var segLength = ~~(buf.length / 3);

  var base = {
    src: '1.1.1.1',
    dst: '2.2.2.2',
    id: 12345,
    dataLength: segLength,
    flags: { mf: true },
    offset: 0
  };

  var ip1 = new IpHeader(base);

  base.offset += ~~(segLength / 8);
  var ip2 = new IpHeader(base);

  base.offset += ~~(segLength / 8);
  base.flags.mf = false;
  var ip3 = new IpHeader(base);

  var buf1 = new Buffer(ip1.length + segLength);
  ip1.toBuffer(buf1, 0);
  buf.copy(buf1, ip1.length, 0, segLength);
  var msg1 = {
    data: buf1
  };

  var buf2 = new Buffer(ip2.length + segLength);
  ip2.toBuffer(buf2, 0);
  buf.copy(buf2, ip2.length, segLength, 2*segLength);
  var msg2 = {
    data: buf2
  };

  var buf3 = new Buffer(ip3.length + segLength);
  ip3.toBuffer(buf3, 0);
  buf.copy(buf3, ip3.length, 2*segLength, 3*segLength);
  var msg3 = {
    data: buf3
  };

  return [msg1, msg2, msg3];
}
