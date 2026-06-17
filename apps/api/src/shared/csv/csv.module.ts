import { Global, Module } from '@nestjs/common'
import { CsvParserService } from './csv-parser.service'

/**
 * Global CSV module. Exports the parser service so any feature
 * module that ingests CSV (students bulk import, future ones) can
 * inject it via the standard `CsvParserService` token without
 * having to add a per-module import.
 */
@Global()
@Module({
  providers: [CsvParserService],
  exports: [CsvParserService],
})
export class CsvModule {}
