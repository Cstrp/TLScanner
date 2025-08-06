import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from "fs/promises";
import maxmind, { CountryResponse, Reader } from "maxmind";
import * as net from 'net';
import { logger } from '../utils';

@Injectable()
export class GeoService implements OnModuleInit {
  private geoReader: Reader<CountryResponse> | null = null;

  constructor() { }

  /**
   * Initializes the GeoIP database reader.
   * This method is called when the module is initialized.
   */
  public async onModuleInit() {
    await this.initializeGeoReader();
  }

  /**
   * Initializes the GeoIP database reader.
   * It tries to load the database from several predefined paths.
   */
  private async initializeGeoReader(): Promise<void> {
    const dbPaths = [
      "GeoLite2-Country.mmdb",
      "Country.mmdb",
      "./public/Country.mmdb",
      "./GeoLite2-Country.mmdb"
    ];

    for (const dbPath of dbPaths) {
      try {
        this.geoReader = await maxmind.open<CountryResponse>(dbPath);
        return;
      } catch {
        continue;
      }
    }

    for (const dbPath of dbPaths) {
      try {
        const buffer = await fs.readFile(dbPath);

        if (!buffer || buffer.length === 0) {
          continue;
        }

        this.geoReader = new Reader<CountryResponse>(buffer);
        logger.info(`Enabled GeoIP (using buffer) from: ${dbPath}`);
        return;
      } catch {
        continue;
      }
    }

    logger.warn("Cannot find any GeoIP database file. Tried:", '', dbPaths.join(", "));
    logger.info("Please download Country.mmdb from https://github.com/Loyalsoldier/geoip/releases/latest/download/Country.mmdb. Or run download-db.sh script");
  }

  /**
   * Gets the GeoIP country code for a given IP address.
   * @param ip - The IP address to look up.
   * @returns The ISO country code or "N/A" if not found or invalid.
   */
  public getGeo(ip: string): string {
    if (!this.geoReader) {
      return "N/A";
    }

    try {
      const validIP = this.validateIP(ip);
      if (!validIP) {
        throw new Error("Invalid IP address");
      }

      const result = this.geoReader.get(validIP);
      return result?.country?.iso_code || "N/A";
    } catch (error) {
      console.debug("Error reading geo:", error);
      return "N/A";
    }
  }

  /**
   * Validates the IP address format.
   * @param ip - The IP address to validate.
   * @returns The valid IP address or null if invalid.
   */
  private validateIP(ip: string): string | null {
    const parsed = net.isIP(ip);
    if (parsed === 0) return null;
    return ip;
  }

  /**
   * Checks if the GeoIP database is available.
   * @returns True if the GeoIP database is available, false otherwise.
   */
  public isGeoIPAvailable(): boolean {
    return this.geoReader !== null;
  }

  /**
   * Reloads the GeoIP database.
   * This method can be used to refresh the database without restarting the application.
   */
  public async reloadDatabase(): Promise<void> {
    await this.initializeGeoReader();
  }
}
