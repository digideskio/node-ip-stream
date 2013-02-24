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

module.exports = IpStream;

var IpHeader = require('ip-header');
var Transform = require('stream').Transform;
if (!Transform) {
  Transform = require('readable-stream/transform');
}
var util = require('util');

util.inherits(IpStream, Transform);

function IpStream(opts) {
  var self = (this instanceof IpStream)
           ? this
           : Object.create(IpStream.prototype);

  opts = opts || {};

  if (opts.objectMode === false) {
    throw new Error('IpStream requires objectMode; do not set ' +
                    'option {objectMode: false}');
  }
  opts.objectMode = true;

  Transform.call(self, opts);

  self._fragments = {};

  return self;
}

IpStream.prototype._transform = function(origMsg, output, callback) {
  var msg = origMsg;
  if (msg instanceof Buffer) {
    msg = { data: msg, offset: 0 };
  }
  msg.offset = ~~msg.offset;

  var type = (msg.ether && msg.ether.type) ? msg.ether.type : 'ip';
  if (type !== 'ip') {
    this.emit('ignored', origMsg);
    callback();
    return;
  }

  try {
    msg.ip = new IpHeader(msg.data, msg.offset);
    msg.offset += msg.ip.length;

    // TODO: handle fragmentation
    if (msg.ip.flags.mf || msg.ip.offset) {
      msg = this._handleFragment(msg);
      if (!msg) {
        callback();
        return;
      }
    }

    output(msg);

  } catch (error) {
    this.emit('ignored', origMsg);
  }

  callback();
}

IpStream.prototype._handleFragment = function(msg) {
  var key = msg.ip.src + '-' + msg.ip.dst + '-' + msg.ip.id;

  // TODO: cleanup stale fragments to avoid memory leaks

  var list = this._fragments[key];
  if (!list) {
    list = this._fragments[key] = [];
  }

  list.push(msg);
  list.sort(function(a, b) {
    return a.ip.offset - b.ip.offset;
  });

  // If the last packet still expects more fragments, can't reassemble yet.
  if (list[list.length - 1].ip.flags.mf) {
    return null;
  }

  // Ok, last packet is here, do we have the rest?  If there is a gap in
  // the sequence of bytes, then we can't reassemble yet.
  var totalLength = 0;
  var bufferList = [];
  var expectedOffset = 0;
  for (var i = 0, n = list.length; i < n; ++i) {
    var packet = list[i];

    if (packet.ip.offset !== expectedOffset) {
      return null;
    }

    totalLength += packet.ip.dataLength;
    bufferList.push(packet.data.slice(~~packet.offset));
    expectedOffset += (packet.ip.dataLength / 8);
  }

  msg.data = Buffer.concat(bufferList, totalLength);
  msg.ip.dataLength = msg.data.length;
  msg.ip.totalLength = msg.ip.length + msg.ip.dataLength;
  msg.ip.flags.mf = false;
  msg.ip.offset = 0;

  delete this._fragments[key];

  return msg;
};
