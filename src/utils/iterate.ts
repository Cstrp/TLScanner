import { validateDomainName } from "./validate-domain-name";
import { Host, HostType } from "../types";
import { lookupIP } from "./lookup-ip";
import * as readline from "readline";
import { nextIP } from "./next-ip";
import { logger } from "./logger";
import * as stream from "stream";
import * as net from "net";


/**
 * Iterates over lines from a readable stream and yields Host objects.
 * Supports IP addresses, CIDR ranges, and domain names.
 * @param reader - The readable stream to read lines from.
 * @param enableIPv6 - Whether to enable IPv6 processing (default: true).
 * @returns An async generator yielding Host objects.
 */
export async function* iterate(reader: stream.Readable, enableIPv6: boolean = true): AsyncGenerator<Host> {
  const rl = readline.createInterface({
    input: reader,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    const ip = net.isIP(trimmedLine);
    if (ip && (ip === 4 || (ip === 6 && enableIPv6))) {
      yield { ip: trimmedLine, origin: trimmedLine, type: HostType.IP };
      continue;
    }

    // Check for CIDR
    const cidrMatch = trimmedLine.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d{1,2})$/);
    if (cidrMatch) {
      const [, baseIp, mask] = cidrMatch;
      const maskNum = parseInt(mask, 10);
      if (maskNum >= 0 && maskNum <= 32) {
        const start = baseIp.split(".").map(Number);
        const current = [...start];
        const max = 32 - maskNum;
        for (let i = 0; i < Math.pow(2, max); i++) {
          const ipStr = current.join(".");
          if (net.isIP(ipStr)) {
            yield { ip: ipStr, origin: trimmedLine, type: HostType.CIDR };
          }
          current[3]++;
          if (current[3] > 255) {
            current[3] = 0;
            current[2]++;
            if (current[2] > 255) {
              current[2] = 0;
              current[1]++;
              if (current[1] > 255) {
                break;
              }
            }
          }
        }
      }
      continue;
    }

    if (validateDomainName(trimmedLine)) {
      yield { ip: null, origin: trimmedLine, type: HostType.Domain };
      continue;
    }

    logger.warn(`Not a valid IP, CIDR, or domain: ${trimmedLine}`);
  }
}

/**
 * Iterates over a single address and yields Host objects.
 * Supports IP addresses, CIDR ranges, and domain names.
 * @param addr - The address to iterate over.
 * @returns An async generator yielding Host objects.
 */
export async function* iterateAddr(addr: string): AsyncGenerator<Host> {
  const cidrMatch = addr.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d{1,2})$/);

  if (cidrMatch) {
    const reader = new stream.Readable();
    reader.push(addr);
    reader.push(null);
    yield* iterate(reader);
    return;
  }

  const ip = net.isIP(addr);

  if (ip) {
    yield { ip: addr, origin: addr, type: HostType.IP };

    logger.info("Enable infinite mode", { init: addr });

    let lowIP = addr;
    let highIP = addr;

    for (let i = 0; i < Number.MAX_SAFE_INTEGER; i++) {
      if (i % 2 === 0) {
        lowIP = nextIP(lowIP, false) || lowIP;
        yield { ip: lowIP, origin: lowIP, type: HostType.IP };
      } else {
        highIP = nextIP(highIP, true) || highIP;
        yield { ip: highIP, origin: highIP, type: HostType.IP };
      }
    }
  } else {
    const resolvedIP = await lookupIP(addr);

    if (resolvedIP) {
      yield { ip: resolvedIP, origin: addr, type: HostType.IP };

      logger.info("Enable infinite mode", { init: resolvedIP });

      let lowIP = resolvedIP;
      let highIP = resolvedIP;

      for (let i = 0; i < Number.MAX_SAFE_INTEGER; i++) {
        if (i % 2 === 0) {
          lowIP = nextIP(lowIP, false) || lowIP;
          yield { ip: lowIP, origin: lowIP, type: HostType.IP };
        } else {
          highIP = nextIP(highIP, true) || highIP;
          yield { ip: highIP, origin: highIP, type: HostType.IP };
        }
      }
    } else {
      logger.error("Not a valid IP, CIDR, or domain:", { addr });
    }
  }
}
