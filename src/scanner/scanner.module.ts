import { ScannerService } from './scanner.service';
import { GeoService } from '../geo/geo.service';
import { Module } from '@nestjs/common';

@Module({
  providers: [ScannerService, GeoService],
  exports: [ScannerService]
})
export class ScannerModule { }
