import * as net from "net";
import { logger } from "./logger";

/**
 * Expands an IPv6 address by filling in the missing parts.
 * @param ip - The IPv6 address to expand.
 * @returns The expanded IPv6 address.
 */
function expandIPv6(ip: string): string {
  if (ip.includes('::')) {
    const parts = ip.split('::');
    const leftParts = parts[0] ? parts[0].split(':') : [];
    const rightParts = parts[1] ? parts[1].split(':') : [];
    const missingParts = 8 - leftParts.length - rightParts.length;

    const expandedParts: string[] = [
      ...leftParts,
      ...Array(missingParts).fill('0000') as string[],
      ...rightParts
    ];

    return expandedParts.map(part => part.padStart(4, '0')).join(':');
  }

  return ip.split(':').map(part => part.padStart(4, '0')).join(':');
}

/**
 * Converts a BigInt to an IPv6 address string.
 * @param bigInt - The BigInt representation of the IPv6 address.
 * @returns The formatted IPv6 address string.
 */
function bigIntToIPv6(bigInt: bigint): string {
  const hexString = bigInt.toString(16).padStart(32, '0');
  const parts: string[] = [];
  for (let i = 0; i < 32; i += 4) {
    parts.push(hexString.slice(i, i + 4));
  }

  const cleanParts = parts.map(part => part.replace(/^0+/, '') || '0');

  let bestStart = -1;
  let bestLength = 0;
  let currentStart = -1;
  let currentLength = 0;

  for (let i = 0; i < cleanParts.length; i++) {
    if (cleanParts[i] === '0') {
      if (currentStart === -1) {
        currentStart = i;
        currentLength = 1;
      } else {
        currentLength++;
      }
    } else {
      if (currentLength > bestLength) {
        bestStart = currentStart;
        bestLength = currentLength;
      }
      currentStart = -1;
      currentLength = 0;
    }
  }

  if (currentLength > bestLength) {
    bestStart = currentStart;
    bestLength = currentLength;
  }

  if (bestLength >= 2) {
    const beforeCompression = cleanParts.slice(0, bestStart);
    const afterCompression = cleanParts.slice(bestStart + bestLength);

    if (beforeCompression.length === 0 && afterCompression.length === 0) {
      return '::';
    } else if (beforeCompression.length === 0) {
      return '::' + afterCompression.join(':');
    } else if (afterCompression.length === 0) {
      return beforeCompression.join(':') + '::';
    } else {
      return beforeCompression.join(':') + '::' + afterCompression.join(':');
    }
  }

  return cleanParts.join(':');
}

/**
 * Generates the next or previous IP address based on the given IP and increment flag.
 * @param ip - The current IP address as a string.
 * @param increment - If true, generates the next IP; if false, generates the previous IP.
 * @param enableIPv6 - Whether to enable IPv6 processing (default: true).
 * @returns The next or previous IP address as a string, or null if invalid.
 */
export function nextIP(ip: string, increment: boolean, enableIPv6: boolean = true): string | null {
  try {
    const ipAddr = net.isIP(ip);
    if (!ipAddr) return null;

    const parts = ip.split(".").map(Number);
    if (ipAddr === 4) {
      let value = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
      value = increment ? value + 1 : value - 1;
      if (value < 0 || value > 0xffffffff) return null;
      return [
        (value >>> 24) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 8) & 0xff,
        value & 0xff,
      ]
        .join(".");
    } else if (ipAddr === 6 && enableIPv6) {
      try {
        const expandedIP = expandIPv6(ip);
        const hexParts = expandedIP.split(':');
        let bigIntValue = 0n;

        for (let i = 0; i < hexParts.length; i++) {
          const hexValue = BigInt(parseInt(hexParts[i], 16));
          bigIntValue = (bigIntValue << 16n) + hexValue;
        }

        const result = increment ? bigIntValue + 1n : bigIntValue - 1n;

        const maxIPv6 = (1n << 128n) - 1n;
        if (result < 0n || result > maxIPv6) {
          return null;
        }

        return bigIntToIPv6(result);
      } catch (error) {
        logger.error("Error in IPv6 processing:", error);
        return null;
      }
    }
    return null;
  } catch (error) {
    logger.error("Error in nextIP:", error);
    return null;
  }
}
