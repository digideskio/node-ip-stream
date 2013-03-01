# ip-stream

IP header serialization object stream.

[![Build Status](https://travis-ci.org/wanderview/node-ip-stream.png)](https://travis-ci.org/wanderview/node-ip-stream)

## Example

### Reading

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
ipstream.on('ignored', function(error, msg) {
  console.log('Ignored message [' + msg + '] due to [' + error + ']');
});

ipstream.read(0);

// you can also control how fragments are handled
var ipsream2 = new IpStream({fragments: 'reassemble'}); // the default
var ipsream3 = new IpStream({fragments: 'drop'});       // ignore fragments
var ipsream4 = new IpStream({fragments: 'pass'});       // passthrough frags

// When reassembling, unmatched fragments are timed-out after 30 seconds by
// default, but you can configure that:
var ipstream5 = new IpStream({fragmentTimeout: 5000});
```

### Writing

```javascript
  var IpStream = require('ip-stream');
  var EtherStream = require('ether-stream');
  var IpHeader = require('ip-header');
  var EtherFrame = require('ether-frame');

  var estream = new EtherStream();
  var ipstream = new IpStream();

  estream.pipe(ipstream);

  // define the content to write out to the buffer
  var in = {
    ether: new EtherFrame({ dst: '01:23:45:54:32:10' }),
    ip: new IpHeader({ dst: '1.1.1.1', dataLength: 500 }),
    data: new Buffer(8*1024)    // adequate storage for header
  };

  // NOTE: packet payload is not in.data, that must be appended later

  estream.write(in);
  var out = ipstream.read();

  // header values have been written to the buffer
  out.offset === (in.ether.length * in.ip.length);
  test.deepEqual(in.ether, new EtherFrame(out.data, 0));
  test.deepEqual(in.ip, new IpHeader(out.data, in.ether.length));
```
