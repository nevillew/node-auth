import ipaddr from 'ipaddr.js';
import { Result, success, failure } from './errors';

/**
 * Validate if a string is a valid IP address (pure function)
 */
export const isValidIP = (ip: string): boolean => {
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
};

/**
 * Validate if a string is a valid CIDR notation (pure function)
 */
export const isValidCIDR = (range: string): boolean => {
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
};

/**
 * Check if an IP is within a CIDR range (pure function)
 */
export const isIPInRange = (ip: string, range: string): boolean => {
  try {
    const addr = ipaddr.parse(ip);
    const [rangeAddr, bits] = ipaddr.parseCIDR(range);
    return addr.match(rangeAddr, bits);
  } catch (error) {
    return false;
  }
};

/**
 * Normalize an IP address (pure function)
 */
export const normalizeIP = (ip: string): Result<string> => {
  try {
    return success(ipaddr.parse(ip).toString());
  } catch (error) {
    return failure({
      message: 'Invalid IP address format',
      statusCode: 400,
      originalError: error instanceof Error ? error : new Error('IP normalization failed')
    });
  }
};

/**
 * Check if an IP is in any of the provided CIDR ranges (pure function)
 */
export const isIPInAnyRange = (ip: string, ranges: string[]): boolean => {
  return ranges.some(range => isIPInRange(ip, range));
};

/**
 * Categorize an IP address as public, private, or other (pure function)
 */
export const categorizeIP = (
  ip: string
): Result<'public' | 'private' | 'loopback' | 'linkLocal' | 'reserved'> => {
  try {
    const addr = ipaddr.parse(ip);
    const range = addr.range();
    
    if (range === 'unicast') return success('public');
    if (range === 'private') return success('private');
    if (range === 'loopback') return success('loopback');
    if (range === 'linkLocal') return success('linkLocal');
    
    return success('reserved');
  } catch (error) {
    return failure({
      message: 'IP categorization failed',
      statusCode: 400,
      originalError: error instanceof Error ? error : new Error('IP categorization failed')
    });
  }
};