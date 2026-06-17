import { Global, Module } from '@nestjs/common'
import { CloudinaryService } from './cloudinary.service'

/**
 * Global Cloudinary module. The service is stateless apart from its
 * SDK config; any module that needs image upload can inject
 * `CloudinaryService` directly.
 */
@Global()
@Module({
  providers: [CloudinaryService],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
