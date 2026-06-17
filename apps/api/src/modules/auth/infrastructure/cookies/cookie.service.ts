import { Injectable } from '@nestjs/common'
import type { Response } from 'express'

/**
 * Cookie names (per design §3.4). Namespaced with `asistencia_` to avoid
 * collisions with other apps on the same domain in dev (where the API
 * is on `*.app.localhost:3000` and may share a wildcard cert with other
 * dev tools).
 */
export const ACCESS_COOKIE_NAME = 'asistencia_access'
export const REFRESH_COOKIE_NAME = 'asistencia_refresh'

export interface CookieAttrs {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax' | 'strict' | 'none'
  path: string
  domain?: string
  maxAgeMs: number
}

/**
 * Cookie helper — central place that decides cookie attributes for the
 * auth endpoints. Per design Q3, SameSite=Lax (not Strict) because the
 * SaaS needs to work across `*.app.localhost` dev and `*.app.com` prod
 * with a single wildcard cert.
 *
 * HttpOnly is mandatory (XSS protection). Secure is on in prod only.
 */
@Injectable()
export class CookieService {
  private readonly secure: boolean
  private readonly sameSite: 'lax' | 'strict' | 'none'
  private readonly domain: string | undefined
  private readonly accessName: string
  private readonly refreshName: string

  constructor() {
    this.secure = process.env.COOKIE_SECURE === 'true'
    const samesite = (process.env.COOKIE_SAMESITE ?? 'lax').toLowerCase()
    this.sameSite = samesite === 'strict' ? 'strict' : samesite === 'none' ? 'none' : 'lax'
    this.domain = process.env.COOKIE_DOMAIN?.trim() || undefined
    this.accessName = process.env.COOKIE_ACCESS_NAME ?? ACCESS_COOKIE_NAME
    this.refreshName = process.env.COOKIE_REFRESH_NAME ?? REFRESH_COOKIE_NAME
  }

  attrs(maxAgeSeconds: number): CookieAttrs {
    return {
      httpOnly: true,
      secure: this.secure,
      sameSite: this.sameSite,
      path: '/',
      ...(this.domain ? { domain: this.domain } : {}),
      maxAgeMs: maxAgeSeconds * 1000,
    }
  }

  setAccess(res: Response, token: string, expiresInSeconds: number): void {
    res.cookie(this.accessName, token, this.attrs(expiresInSeconds))
  }

  setRefresh(res: Response, token: string, expiresInSeconds: number): void {
    res.cookie(this.refreshName, token, this.attrs(expiresInSeconds))
  }

  clearBoth(res: Response): void {
    // The clear directive must mirror the original cookie's attributes
    // except for maxAge, otherwise browsers won't overwrite. (REQ-AUTH-006.)
    const clearAttrs = this.attrs(0)
    res.clearCookie(this.accessName, {
      httpOnly: clearAttrs.httpOnly,
      secure: clearAttrs.secure,
      sameSite: clearAttrs.sameSite,
      path: clearAttrs.path,
      ...(clearAttrs.domain ? { domain: clearAttrs.domain } : {}),
    })
    res.clearCookie(this.refreshName, {
      httpOnly: clearAttrs.httpOnly,
      secure: clearAttrs.secure,
      sameSite: clearAttrs.sameSite,
      path: clearAttrs.path,
      ...(clearAttrs.domain ? { domain: clearAttrs.domain } : {}),
    })
  }

  /**
   * Convenience to parse the cookie TTL from the access token expiry.
   * Reads `JWT_ACCESS_TTL` env (e.g. '15m', '7d') and converts to seconds.
   */
  static ttlToSeconds(ttl: string): number {
    const m = /^(\d+)(ms|s|m|h|d)$/i.exec(ttl.trim())
    if (!m) throw new Error(`Invalid TTL: ${ttl}`)
    const value = Number(m[1])
    const unit = (m[2] ?? 's').toLowerCase()
    return unit === 'ms'
      ? value / 1000
      : unit === 's'
        ? value
        : unit === 'm'
          ? value * 60
          : unit === 'h'
            ? value * 60 * 60
            : value * 24 * 60 * 60
  }

  get accessCookieName(): string {
    return this.accessName
  }

  get refreshCookieName(): string {
    return this.refreshName
  }
}
