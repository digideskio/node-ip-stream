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
var ObjectTransform = require('object-transform');
var util = require('util');

util.inherits(IpStream, ObjectTransform);

function IpStream(opts) {
  var self = (this instanceof IpStream)
           ? this
           : Object.create(IpStream.prototype);

  opts = opts || {};

  opts.meta = 'ip';

  ObjectTransform.call(self, opts);

  if (self.ip && typeof self.ip.toBuffer !== 'function') {
    throw new Error('IpStream optional ip value must be null or provide a ' +
                    'toBuffer() function.');
  }

  self._fragmentsMode = opts.fragments || 'reassemble';
  if (self._fragmentsMode !== 'reassemble' &&
      self._fragmentsMode !== 'drop' &&
      self._fragmentsMode !== 'pass') {
    throw new Error('IpStream fragments option must be one of ' +
                    '[reassemble, drop, pass]; value [' + opts.fragments +
                    '] is invalid');
  }

  self._fragments = {};
  self._timers = {};
  self._fragmentTimeout = opts.fragmentTimeout || (30 * 1000);

  return self;
}

IpStream.prototype._reduce = function(msg, output, callback) {
  var type = (msg.ether && msg.ether.type) ? msg.ether.type : 'ip';
  if (type !== 'ip') {
    var error = new Error('Message type is [' + type + ']; must be ip');
    this.emit('ignored', error, msg);
    callback();
    return;
  }

  msg.ip = new IpHeader(msg.data, msg.offset);
  msg.offset += msg.ip.length;

  if (msg.ip.flags.mf || msg.ip.offset) {
    if (this._fragmentsMode === 'drop') {
      var error = new Error('Fragmented packet.');
      this.emit('ignored', error, msg);
      callback();
      return;
    }

    if (this._fragmentsMode === 'reassemble') {
      msg = this._handleFragment(msg);
      if (!msg) {
        callback();
        return;
      }
    }
  }

  return msg;
}

IpStream.prototype._expand = function(ip, msg, output, callback) {
  // TODO: fragment jumbo packets into multiple messages
  ip.toBuffer(msg.data, msg.offset);
  msg.offset += ip.length;
  return msg;
};

IpStream.prototype._handleFragment = function(msg) {
  var key = msg.ip.src + '-' + msg.ip.dst + '-' + msg.ip.id;

  var list = this._fragments[key];
  if (!list) {
    list = this._fragments[key] = [];
    this._timers[key] = setTimeout(this._doTimeout.bind(this, key),
                                   this._fragmentTimeout);
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
  if (this._timers[key]) {
    clearTimeout(this._timers[key]);
    delete this._timers[key];
  }

  return msg;
};

IpStream.prototype._doTimeout = function(key) {
  var list = this._fragments[key];

  delete this._fragments[key];
  delete this._timers[key];

  if (list) {
    for (var i = 0, n = list.length; i < n; ++i) {
      var error = new Error('Fragment timed out.');
      this.emit('ignored', error, list[i]);
    }
  }
};
