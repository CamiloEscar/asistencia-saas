import { Global, Module } from '@nestjs/common'
import { ARGON2_OPTIONS, PasswordHasherService } from './password-hasher.service'
import { JwtKeysService } from './jwt-keys.service'
import { JwtService } from './jwt.service'

/**
 * Crypto module — provides password hashing + JWT sign/verify.
 *
 * Note: `JwtKeysService.init()` is NOT called here — it's called from
 * `main.ts` before the Nest application starts, so that a key generation
 * failure crashes the boot with a clear message rather than being hidden
 * behind DI lifecycle noise.
 *
 * The keys provider is registered as a factory bound to env vars; it is
 * NOT instantiated at module-load time, only when `JwtKeysService` is
 * first injected.
 */
@Global()
@Module({
  providers: [
    {
      provide: ARGON2_OPTIONS,
      useFactory: () => ({
        memoryCost: Number(process.env.ARGON2_MEMORY_COST ?? 65536),
        timeCost: Number(process.env.ARGON2_TIME_COST ?? 3),
        parallelism: Number(process.env.ARGON2_PARALLELISM ?? 4),
      }),
    },
    {
      provide: JwtKeysService,
      useFactory: () =>
        new JwtKeysService(
          process.env.JWT_PRIVATE_KEY_PATH ?? './secrets/jwt-private.pem',
          process.env.JWT_PUBLIC_KEY_PATH ?? './secrets/jwt-public.pem',
        ),
    },
    {
      provide: JwtService,
      useFactory: (keys: JwtKeysService) =>
        new JwtService(keys, {
          access: process.env.JWT_ACCESS_TTL ?? '15m',
          refresh: process.env.JWT_REFRESH_TTL ?? '7d',
          activation: process.env.JWT_ACTIVATION_TTL ?? '48h',
        }),
      inject: [JwtKeysService],
    },
    PasswordHasherService,
  ],
  exports: [PasswordHasherService, JwtKeysService, JwtService, ARGON2_OPTIONS],
})
export class CryptoModule {}
