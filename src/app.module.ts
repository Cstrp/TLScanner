import { ScannerModule } from './scanner/scanner.module';
import { GeoModule } from './geo/geo.module';
import { AppService } from './app.service';
import { Module } from '@nestjs/common';

@Module({
  providers: [AppService],
  imports: [GeoModule, ScannerModule],
})
export class AppModule { }
