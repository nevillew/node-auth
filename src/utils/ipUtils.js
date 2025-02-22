const ipaddr = require('ipaddr.js');

function isValidIP(ip) {
  try {
    ipaddr.parse(ip);
    return true;
  } catch (error) {
    return false;
  }
}

function isValidCIDR(range) {
  try {
    ipaddr.parseCIDR(range);
    return true;
  } catch (error) {
    return false;
  }
}

function isIPInRange(ip, range) {
  try {
    const addr = ipaddr.parse(ip);
    const [rangeAddr, bits] = ipaddr.parseCIDR(range);
    return addr.match(rangeAddr, bits);
  } catch (error) {
    return false;
  }
}

function normalizeIP(ip) {
  try {
    return ipaddr.parse(ip).toString();
  } catch (error) {
    return null;
  }
}

module.exports = {
  isValidIP,
  isValidCIDR,
  isIPInRange,
  normalizeIP
};
