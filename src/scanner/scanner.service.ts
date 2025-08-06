import { Host, HostType, TLSScanResult } from '../types';
import { GeoService } from '../geo/geo.service';
import { Injectable } from '@nestjs/common';
import { lookupIP, logger } from '../utils';
import * as tls from 'tls';
import * as net from 'net';

@Injectable()
export class ScannerService {
  private readonly port: number = 443;
  private readonly timeout: number = 10;

  constructor(private readonly geoService: GeoService) { }

  /**
   * Scans a host for TLS capabilities.
   * @param host - The host to scan, which can be an IP address, CIDR, or domain.
   * @returns A promise that resolves to a TLSScanResult or null if the scan fails
   *
  */
  public async scanTLS(host: Host): Promise<TLSScanResult | null> {
    try {
      if (!host.ip) {
        const resolvedIP = await lookupIP(host.origin);

        if (!resolvedIP) {
          logger.debug(`Failed to get IP from the origin { origin: ${host.origin} }`);
          return null;
        }

        host.ip = resolvedIP;
      }

      const hostPort = `${host.ip}:${this.port}`;

      const socket = await this.createConnection(host.ip, this.port);

      try {
        socket.setTimeout(this.timeout * 1000);

        const tlsOptions: tls.ConnectionOptions = {
          socket: socket,
          rejectUnauthorized: false,
          ALPNProtocols: ['h2', 'http/1.1'],
          secureProtocol: 'TLS_method',
        };

        if (host.type === HostType.Domain) {
          tlsOptions.servername = host.origin;
        }

        const tlsSocket = await this.performTLSHandshake(tlsOptions);

        try {
          const protocol = tlsSocket.getProtocol();
          const alpn = tlsSocket.alpnProtocol || '';
          const cert = tlsSocket.getPeerCertificate(false);

          if (!cert || !cert.subject) {
            logger.debug("No certificate received", { target: hostPort });
            return null;
          }

          const domain = cert.subject.CN || '';
          const issuers = cert.issuer?.O
            ? (Array.isArray(cert.issuer.O) ? cert.issuer.O.join(' | ') : cert.issuer.O)
            : '';

          const geoCode = this.geoService.getGeo(host.ip);

          const feasible = this.isFeasible(protocol, alpn, domain, issuers);

          const result: TLSScanResult = {
            ip: host.ip,
            origin: host.origin,
            domain,
            issuer: issuers,
            geoCode,
            feasible,
            tlsVersion: protocol || 'unknown',
            alpn: alpn || 'none'
          };

          const logLevel = feasible ? 'info' : 'debug';
          logger[logLevel](`Connected to target: IP=${host.ip}, Origin=${host.origin}, TLS=${protocol}, ALPN=${alpn}, CertDomain=${domain}, CertIssuer=${issuers}, Geo=${geoCode}`);

          return result;

        } finally {
          tlsSocket.destroy();
        }

      } finally {
        socket.destroy();
      }

    } catch (error) {
      logger.debug(`TLS scan failed: target=${host.ip}:${this.port}, error=${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Formats a TLSScanResult into a CSV line.
   * @param result - The TLSScanResult to format.
   * @returns A string representing the result in CSV format, or an empty string if not feasible.
   */
  public formatScanResult(result: TLSScanResult): string {
    if (!result.feasible) {
      return '';
    }

    return [
      result.ip,
      result.origin,
      result.domain,
      `"${result.issuer}"`,
      result.geoCode
    ].join(',') + '\n';
  }

  /**
   * Scans multiple hosts for TLS capabilities in batches.
   * @param hosts - An array of Host objects to scan.
   * @param concurrency - The number of concurrent scans to perform (default: 10).
   * @returns A promise that resolves to an array of TLSScanResult objects.
   */
  public async scanTLSBatch(hosts: Host[], concurrency: number = 10): Promise<TLSScanResult[]> {
    const results: TLSScanResult[] = [];

    for (let i = 0; i < hosts.length; i += concurrency) {
      const batch = hosts.slice(i, i + concurrency);

      const batchPromises = batch.map(async (host) => {
        try {
          return await this.scanTLS(host);
        } catch (error) {
          logger.debug(`Batch scan error: host=${host.origin}, error=${error instanceof Error ? error.message : String(error)}`);
          return null;
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        }
      }

      if (i + concurrency < hosts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Generates a CSV output from an array of TLSScanResult objects.
   * @param results - The array of TLSScanResult objects.
   * @returns A string representing the results in CSV format.
   */
  public generateCSVOutput(results: TLSScanResult[]): string {
    const feasibleResults = results.filter(r => r.feasible);
    const header = 'IP,Origin,Domain,Issuer,GeoCode\n';
    const rows = feasibleResults.map(r => this.formatScanResult(r)).join('');
    return header + rows;
  }

  /**
   * Creates a TCP connection to the specified host and port.
   * @param host - The IP address or hostname to connect to.
   * @param port - The port number to connect to.
   * @returns A promise that resolves to a net.Socket instance.
   */
  private async createConnection(host: string, port: number): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();

      const timeoutId = setTimeout(() => {
        socket.destroy();
        reject(new Error(`Connection timeout to ${host}:${port}`));
      }, this.timeout * 1000);

      socket.connect(port, host, () => {
        clearTimeout(timeoutId);
        resolve(socket);
      });

      socket.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Performs a TLS handshake on the given socket with the specified options.
   * @param options - The TLS connection options.
   * @returns A promise that resolves to a TLSSocket instance.
   */
  private async performTLSHandshake(options: tls.ConnectionOptions): Promise<tls.TLSSocket> {
    return new Promise((resolve, reject) => {
      const tlsSocket = tls.connect(options);

      const timeoutId = setTimeout(() => {
        tlsSocket.destroy();
        reject(new Error('TLS handshake timeout'));
      }, this.timeout * 1000);

      tlsSocket.on('secureConnect', () => {
        clearTimeout(timeoutId);
        resolve(tlsSocket);
      });

      tlsSocket.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }

  /**
   * Checks if the TLS connection is feasible based on protocol, ALPN, domain, and issuers.
   * @param protocol - The TLS protocol version.
   * @param alpn - The ALPN protocol used.
   * @param domain - The domain from the certificate.
   * @param issuers - The issuers from the certificate.
   * @returns A boolean indicating if the connection is feasible.
   */
  private isFeasible(protocol: string | null, alpn: string, domain: string, issuers: string): boolean {
    return protocol === 'TLSv1.3' &&
      alpn === 'h2' &&
      domain.length > 0 &&
      issuers.length > 0;
  }
}
