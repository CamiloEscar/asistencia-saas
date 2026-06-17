import { Injectable, Logger } from '@nestjs/common'
import { createPublicKey, generateKeyPairSync } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * RS256 keypair lifecycle (per design §3.1, REQ-AUTH-010):
 *   - On first boot, if the PEM files at `JWT_PRIVATE_KEY_PATH` /
 *     `JWT_PUBLIC_KEY_PATH` don't exist, generate a fresh pair (2048-bit).
 *   - Permissions: private 0600, public 0644 (POSIX).
 *   - Subsequent boots load the existing files (no regeneration).
 *   - The keys are exposed to JwtService for sign/verify.
 *
 * Rotation is out of MVP scope. Future work: support 2 active keys (current +
 * previous) for zero-downtime rotation.
 */
@Injectable()
export class JwtKeysService {
  private readonly logger = new Logger(JwtKeysService.name)
  private privateKey!: string
  private publicKey!: string
  private keyId!: string

  constructor(
    private readonly privateKeyPath: string,
    private readonly publicKeyPath: string,
  ) {}

  /**
   * Boot-time initializer. Loads existing keys or generates a new pair.
   * Idempotent: subsequent calls are a no-op.
   */
  init(): void {
    if (this.privateKey && this.publicKey) return

    if (existsSync(this.privateKeyPath) && existsSync(this.publicKeyPath)) {
      this.privateKey = readFileSync(this.privateKeyPath, 'utf-8')
      this.publicKey = readFileSync(this.publicKeyPath, 'utf-8')
      this.logger.log(`Loaded existing RS256 keypair from ${this.privateKeyPath}`)
    } else {
      this.logger.log('No existing keypair — generating new RS256 2048-bit pair')
      const pair = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      })
      this.privateKey = pair.privateKey
      this.publicKey = pair.publicKey

      // Persist for next boot.
      mkdirSync(dirname(this.privateKeyPath), { recursive: true })
      writeFileSync(this.privateKeyPath, this.privateKey, { mode: 0o600 })
      writeFileSync(this.publicKeyPath, this.publicKey, { mode: 0o644 })
      try {
        chmodSync(this.privateKeyPath, 0o600)
        chmodSync(this.publicKeyPath, 0o644)
      } catch {
        // Windows: chmod is a no-op for non-POSIX filesystems.
      }
      this.logger.log(`Generated and persisted RS256 keypair to ${this.privateKeyPath}`)
    }

    // kid is a short fingerprint so JWKS consumers can pin to a specific key
    // (useful when we add key rotation in Hito 2). For MVP we use a fixed kid.
    this.keyId = 'asistencia-key-1'
  }

  getPrivateKey(): string {
    if (!this.privateKey) throw new Error('JwtKeysService not initialized — call init() first')
    return this.privateKey
  }

  getPublicKey(): string {
    if (!this.publicKey) throw new Error('JwtKeysService not initialized — call init() first')
    return this.publicKey
  }

  getKeyId(): string {
    return this.keyId
  }

  /**
   * Convert PEM public key to JWK format for the /.well-known/jwks.json
   * endpoint. Uses Node's KeyObject so we don't pull in `jose`/`node-jose`.
   */
  toJwk(): Jwk {
    const keyObj = createPublicKey(this.publicKey)
    const jwk = keyObj.export({ format: 'jwk' }) as { kty: string; n?: string; e?: string }
    return {
      kty: jwk.kty,
      use: 'sig',
      alg: 'RS256',
      kid: this.keyId,
      n: jwk.n ?? '',
      e: jwk.e ?? '',
    }
  }
}

export interface Jwk {
  kty: string
  use: string
  alg: string
  kid: string
  n: string
  e: string
}
