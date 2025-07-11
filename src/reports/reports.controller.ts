import { Controller, Get, Post, HttpCode } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('api/v1/reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get()
  report() {
    return {
      'accounts.csv': this.reportsService.state('accounts'),
      'yearly.csv': this.reportsService.state('yearly'),
      'fs.csv': this.reportsService.state('fs'),
    };
  }

  @Post()
  @HttpCode(201)
  generate() {
    const start = Date.now();
    setImmediate(async () => {
      try {
        await Promise.all([
          this.reportsService.accounts(),
          this.reportsService.yearly(),
          this.reportsService.fs()
        ]);
        const duration = Date.now() - start;
        console.log(`Report generation finished in ${duration}ms`);
      } catch (error) {
        console.error('Report generation failed:', error);
      }
    });
    return { message: 'processing started' };
  }
}
