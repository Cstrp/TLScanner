import { logger } from "./logger";
import * as dns from "dns";

/**
 * Looks up the IP address of a given hostname or IP address.
 * @param addr - The hostname or IP address to look up.
 * @param enableIPv6 - Whether to enable IPv6 lookup (default: true).
 * @returns A promise that resolves to the IP address as a string, or null if not found.
 */
export async function lookupIP(addr: string, enableIPv6: boolean = true): Promise<string | null> {
  try {
    const ips = await dns.promises.lookup(addr, { family: enableIPv6 ? 6 : 4 });
    return ips.address;
  } catch (error) {
    logger.error(`Failed to lookup ${addr}: ${JSON.stringify(error)}`,);
    return null;
  }
}
