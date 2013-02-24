# ip-stream

Object stream transform that parses IP headers.

[![Build Status](https://travis-ci.org/wanderview/node-ip-stream.png)](https://travis-ci.org/wanderview/node-ip-stream)

## Example

```javascript
var IpStream = require('ip-stream');
var EtherStream = require('ether-stream');
var PcapStream = require('pcap-stream');

var pstream = new PcapStream(PCAP_FILE);
var estream = new EtherStream();
var ipstream = new IpStream();

pstream.pipe(estream).pipe(ipstream);

ipstream.on('readable', function() {
  var msg = ipstream.read();

  msg.ether.src === '12:34:56:65:43:21';  // Ethernet frame is still available

  msg.ip.src === '1.1.1.1';   // IP header data is available at .ip property
  msg.ip.dst === '2.2.2.2';
  msg.ip.protocol === 'udp';

  var payload = msg.data;     // IP packet data is available at .data property
});

// Packets that cannot be parsed as IP are emitted with 'ignored' event
ipstream.on('ignored', function(msg) {
  console.log('Ignored message [' + msg + ']');
});

ipstream.read(0);

// you can also control how fragments are handled
var ipsream2 = new IpStream({fragments: 'reassemble'}); // the default
var ipsream3 = new IpStream({fragments: 'drop'});       // ignore fragments
var ipsream4 = new IpStream({fragments: 'pass'});       // passthrough frags

// When reassembling, unmatched fragments are timed-out after 30 seconds by
// default, but you can configure that:
var ipsream5 = new IpStream({fragmentTimeout: 5000});
```
