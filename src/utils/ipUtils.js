const ipaddr = require('ipaddr.js');

function isIPInRange(ip, range) {
  try {
    // Parse the IP and range
    const addr = ipaddr.parse(ip);
    const [rangeAddr, bits] = ipaddr.parseCIDR(range);

    // Check if the IP is in the range
    return addr.match(rangeAddr, bits);
  } catch (error) {
    return false;
  }
}

module.exports = {
  isIPInRange
};
