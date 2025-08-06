import { Command, CommandRunner, Option } from 'nest-commander';
import { ScannerService } from './scanner/scanner.service';
import { iterateAddr, iterate, logger } from './utils';
import { Injectable } from '@nestjs/common';
import { CLIOptions, Host } from './types';
import * as fs from 'fs/promises';
import { Readable } from 'stream';
import fetch from 'node-fetch';

@Command({
  name: 'tlscanner',
  description: 'TLS Scanner - Find TLS 1.3 + HTTP/2 endpoints (NestJS Commander Version)',
  options: { isDefault: true }
})
@Injectable()
export class AppService extends CommandRunner {
  private outputFile?: fs.FileHandle;
  private scanCount = 0;
  private feasibleCount = 0;
  private startTime!: Date;
  private activeWorkers = 0;
  private isShuttingDown = false;

  constructor(private readonly scannerService: ScannerService) {
    super();
  }

  /**
   * Runs the CLI command with the provided options.
   * @param passedParams - The parameters passed to the command.
   * @param options - The CLI options.
   */
  async run(passedParams: string[], options: CLIOptions): Promise<void> {
    if (options.verbose || (options as any).Verbose) {
      process.env.LOG_LEVEL = 'debug';
    } else {
      process.env.LOG_LEVEL = 'info';
    }

    const addr = options.addr || (options as any).Addr;
    const inFile = options.in || (options as any).In;
    const url = options.url || (options as any).Url;

    const inputCount = [addr, inFile, url].filter(v => v && v.trim() !== '').length;
    if (inputCount !== 1) {
      console.error('You must specify and only specify one of `addr`, `in`, or `url`');
      return;
    }

    this.setupGracefulShutdown();

    const outputPath = options.out || (options as any).Out || 'out.csv';
    await this.setupOutputFile(outputPath);

    const normalizedOptions = {
      addr,
      in: inFile,
      url,
      thread: options.thread || (options as any).Thread || '10',
      port: options.port || (options as any).Port || '443',
      timeout: options.timeout || (options as any).Timeout || '10',
      verbose: options.verbose || (options as any).Verbose || false,
      ipv6: options.ipv6 || (options as any).Ipv6 || false,
      out: outputPath
    };

    const hostIterator = await this.getHostIterator(normalizedOptions);

    await this.startScanning(hostIterator, normalizedOptions);
  }

  /**
   * Parses the address option.
   * @param val - The address value.
   * @returns The parsed address.
   */
  @Option({
    flags: '-addr <address>',
    description: 'Specify an IP, IP CIDR or domain to scan',
  })
  public parseAddr(val: string): string {
    return val;
  }

  /**
   * Parses the input file option.
   * @param val - The input file value.
   * @returns The parsed input file.
   */
  @Option({
    flags: '-in <file>',
    description: 'Specify a file that contains multiple IPs, IP CIDRs or domains to scan, divided by line break',
  })
  public parseIn(val: string): string {
    return val;
  }

  /**
   * Parses the URL option.
   * @param val - The URL value.
   * @returns The parsed URL.
   */
  @Option({
    flags: '-url <url>',
    description: 'Crawl the domain list from a URL, e.g. https://launchpad.net/ubuntu/+archivemirrors',
  })
  public parseUrl(val: string): string {
    return val;
  }

  /**
   * Parses the port option.
   * @param val - The port value.
   * @returns The parsed port.
   */
  @Option({
    flags: '-port <number>',
    description: 'Specify a HTTPS port to check',
    defaultValue: '443',
  })
  public parsePort(val: string): string {
    return val;
  }

  /**
   * Parses the thread option.
   * @param val - The thread value.
   * @returns The parsed thread count.
   */
  @Option({
    flags: '-thread <number>',
    description: 'Count of concurrent tasks',
    defaultValue: '10',
  })
  public parseThread(val: string): string {
    return val;
  }

  /**
   * Parses the output file option.
   * @param val - The output file value.
   * @returns The parsed output file.
   */
  @Option({
    flags: '-out <file>',
    description: 'Output file to store the result',
    defaultValue: 'out.csv',
  })
  parseOut(val: string): string {
    return val;
  }

  /**
   * Parses the timeout option.
   * @param val - The timeout value.
   * @returns The parsed timeout.
   */
  @Option({
    flags: '-timeout <number>',
    description: 'Timeout for every check',
    defaultValue: '10',
  })
  public parseTimeout(val: string): string {
    return val;
  }

  /**
   * Parses the verbose option.
   * @returns True if verbose output is enabled.
   */
  @Option({
    flags: '-v, --verbose',
    description: 'Verbose output',
  })
  public parseVerbose(): boolean {
    return true;
  }

  /**
   * Parses the IPv6 option.
   * @returns True if IPv6 is enabled.
   */
  @Option({
    flags: '-46, --ipv6',
    description: 'Enable IPv6 in addition to IPv4',
  })
  public parseIpv6(): boolean {
    return true;
  }

  /**
   * Gets the host iterator based on the provided options.
   * @param options - The CLI options.
   * @returns An async generator yielding Host objects.
   */
  private async getHostIterator(options: any): Promise<AsyncGenerator<Host>> {
    if (options.addr) {
      return iterateAddr(options.addr);
    } else if (options.in) {
      const fileContent = await fs.readFile(options.in, 'utf-8');
      const stream = Readable.from([fileContent]);
      return iterate(stream);
    } else if (options.url) {
      logger.info('Fetching URL...');
      const response = await fetch(options.url);
      const text = await response.text();

      const regex = /(http|https):\/\/(.*?)[/"<>\s]+/g;
      const domains: string[] = [];
      let match;

      while ((match = regex.exec(text)) !== null) {
        domains.push(match[2]);
      }

      const uniqueDomains = [...new Set(domains)];
      logger.info('Parsed domains', { count: uniqueDomains.length });

      const domainsText = uniqueDomains.join('\n');
      const stream = Readable.from([domainsText]);
      return iterate(stream);
    } else {
      throw new Error('No input specified');
    }
  }

  /**
   * Sets up the output file for writing results.
   * @param outputPath - The path to the output file.
   */
  private async setupOutputFile(outputPath: string): Promise<void> {
    if (outputPath && outputPath !== '') {
      this.outputFile = await fs.open(outputPath, 'w');
      await this.outputFile.writeFile('IP,ORIGIN,CERT_DOMAIN,CERT_ISSUER,GEO_CODE\n');
    }
  }

  /**
   * Starts the scanning process.
   * @param hostIterator - The host iterator.
   * @param options - The CLI options.
   */
  private async startScanning(hostIterator: AsyncGenerator<Host>, options: any): Promise<void> {
    this.startTime = new Date();
    const threadCount = parseInt(options.thread || '10');
    logger.info('Started all scanning threads', { time: this.startTime, threads: threadCount });

    const workers: Promise<void>[] = [];

    for (let i = 0; i < threadCount; i++) {
      workers.push(this.scannerWorker(hostIterator));
    }

    if (options.addr && !options.addr.includes('/')) {
      logger.info('Starting infinite scanning mode - press Ctrl+C to stop');

      return new Promise((resolve) => {
        const checkShutdown = () => {
          if (this.isShuttingDown) {
            resolve();
          } else {
            setTimeout(checkShutdown, 1000);
          }
        };
        checkShutdown();
      });
    } else {
      await Promise.allSettled(workers);

      const elapsed = Date.now() - this.startTime.getTime();
      logger.info('Scanning completed', {
        time: new Date(),
        elapsed: `${elapsed / 1000}s`,
        totalScanned: this.scanCount,
        feasibleFound: this.feasibleCount
      });

      if (this.outputFile) {
        await this.outputFile.close();
      }
    }
  }

  /**
   * Worker function for scanning hosts.
   * @param hostIterator - The host iterator.
   */
  private async scannerWorker(hostIterator: AsyncGenerator<Host>): Promise<void> {
    this.activeWorkers++;

    try {
      for await (const host of hostIterator) {
        if (this.isShuttingDown) {
          break;
        }

        try {
          const result = await this.scannerService.scanTLS(host);
          this.scanCount++;

          if (result && result.feasible) {
            this.feasibleCount++;

            if (this.outputFile) {
              const csvLine = this.scannerService.formatScanResult(result);
              if (csvLine) {
                await this.outputFile.writeFile(csvLine);
              }
            }
          }

          if (this.scanCount % 10 === 0) {
            const elapsed = (Date.now() - this.startTime.getTime()) / 1000;
            const rate = this.scanCount / elapsed;
            logger.info(`Progress: scanned=${this.scanCount}, feasible=${this.feasibleCount}, rate=${rate.toFixed(2)}/s, elapsed=${elapsed.toFixed(1)}s`);
          }

        } catch (error) {
          logger.debug(`Scan error ${host.origin}: ${error instanceof Error ? error.message : String(error)}`);
        }

        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } finally {
      this.activeWorkers--;
    }
  }

  /**
   * Sets up graceful shutdown handling.
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      this.isShuttingDown = true;

      const maxWait = 30000;
      const startWait = Date.now();

      while (this.activeWorkers > 0 && (Date.now() - startWait) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (this.outputFile) {
        await this.outputFile.close();
      }

      const elapsed = this.startTime ? Date.now() - this.startTime.getTime() : 0;
      logger.info(`Shutdown complete: ${elapsed / 1000}s - total scanned: ${this.scanCount}, feasible found: ${this.feasibleCount}`);

      process.exit(0);
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));

    process.on('uncaughtException', (error) => {
      logger.error(`Uncaught exception: ${error instanceof Error ? error.message : String(error)}`);
      void shutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error(`Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
      void shutdown('UNHANDLED_REJECTION');
    });
  }
}

