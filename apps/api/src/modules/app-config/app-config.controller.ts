import { Controller, Get } from '@nestjs/common'
import { Public } from '../auth/presentation/decorators/public.decorator'
import  { AppConfigService } from './app-config.service'

@Controller('config')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get()
  @Public()
  get() {
    return this.appConfigService.get()
  }
}
