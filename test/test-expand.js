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

module.exports.defaults = function(test) {
  test.expect(2);

  var ipDefault = new IpHeader({
    src: '52.13.128.211',
    dst: '1.2.3.4',
    protocol: 'tcp',
    datalength: 672
  });

  var ipstream = new IpStream({ip: ipDefault});

  var input = {
    data: new Buffer(8*1024),
  };

  ipstream.write(input);
  var output = ipstream.read();

  test.deepEqual(ipDefault, output.ip);
  test.deepEqual(ipDefault, new IpHeader(output.data));

  test.done();
};

module.exports.message = function(test) {
  test.expect(2);

  var ipDefault = new IpHeader({
    src: '52.13.128.211',
    dst: '1.2.3.4',
    protocol: 'tcp',
    datalength: 672
  });

  var ipstream = new IpStream({ip: ipDefault});

  var input = {
    data: new Buffer(8*1024),
    ip: new IpHeader({
      src: '1.2.3.4',
      dst: '52.13.128.211',
      protocol: 'udp',
      dataLength: 100
    })
  };

  ipstream.write(input);
  var output = ipstream.read();

  test.deepEqual(input.ip, output.ip);
  test.deepEqual(input.ip, new IpHeader(output.data));

  test.done();
};
