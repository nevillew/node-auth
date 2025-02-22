const ipaddr = require('ipaddr.js');

function isValidIP(ip) {
  try {
    // Basic format validation
    if (!ip || typeof ip !== 'string') return false;
    
    // Check for private/reserved IPs
    const addr = ipaddr.parse(ip);
    if (addr.range() !== 'unicast') return false;
    
    // Validate IPv4 format
    if (addr.kind() === 'ipv4') {
      const parts = ip.split('.');
      if (parts.length !== 4) return false;
      
      return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255 && part === num.toString();
      });
    }
    
    // Validate IPv6 format
    if (addr.kind() === 'ipv6') {
      return /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(ip);
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

function isValidCIDR(range) {
  try {
    if (!range || typeof range !== 'string') return false;
    
    const [ip, bits] = range.split('/');
    if (!ip || !bits) return false;
    
    // Validate IP part
    if (!isValidIP(ip)) return false;
    
    // Validate prefix length
    const prefix = parseInt(bits, 10);
    const addr = ipaddr.parse(ip);
    
    if (addr.kind() === 'ipv4' && (prefix < 0 || prefix > 32)) return false;
    if (addr.kind() === 'ipv6' && (prefix < 0 || prefix > 128)) return false;
    
    // Validate network address
    const [network] = ipaddr.parseCIDR(range);
    return network.toString() === ip;
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
