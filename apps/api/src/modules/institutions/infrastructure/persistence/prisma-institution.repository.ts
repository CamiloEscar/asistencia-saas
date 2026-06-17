import { Inject, Injectable, Logger } from '@nestjs/common'
import type { PrismaClient } from '@prisma/client'
import { SUPER_ADMIN_PRISMA } from '../../../../shared/prisma/prisma.service'
import {
  Institution,
  type InstitutionProps,
  type InstitutionStatus,
} from '../../domain/entities/institution.entity'
import type {
  CreateInstitutionInput,
  IInstitutionRepository,
  ListInstitutionsInput,
  ListInstitutionsResult,
  UpdateInstitutionInput,
} from '../../domain/repositories/institution.repository.interface'

/**
 * Prisma implementation of `IInstitutionRepository`. Uses
 * `SUPER_ADMIN_PRISMA` because institutions are the tenants — there is
 * no parent institutionId to filter by. RLS still applies at the DB
 * (the super-admin role holds BYPASSRLS but the `institutions` table
 * itself is intentionally not subject to RLS, see migration).
 */
@Injectable()
export class PrismaInstitutionRepository implements IInstitutionRepository {
  private readonly logger = new Logger(PrismaInstitutionRepository.name)

  constructor(@Inject(SUPER_ADMIN_PRISMA) private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Institution | null> {
    const row = await this.prisma.institution.findUnique({ where: { id } })
    return row ? this.toEntity(row as unknown as InstitutionProps) : null
  }

  async findBySubdomain(subdomain: string): Promise<Institution | null> {
    const row = await this.prisma.institution.findUnique({
      where: { subdomain: subdomain.toLowerCase() },
    })
    return row ? this.toEntity(row as unknown as InstitutionProps) : null
  }

  async list(input: ListInstitutionsInput): Promise<ListInstitutionsResult> {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100)
    const where: Record<string, unknown> = {}
    if (input.isActive !== null && input.isActive !== undefined) {
      where.status = input.isActive ? 'ACTIVE' : 'INACTIVE'
    }
    if (input.search) {
      const q = input.search.trim()
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { subdomain: { contains: q, mode: 'insensitive' } },
      ]
    }

    const rows = await this.prisma.institution.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    })

    const hasMore = rows.length > limit
    const slice = hasMore ? rows.slice(0, limit) : rows
    const lastId = slice.length > 0 ? slice[slice.length - 1]!.id : null

    return {
      data: slice.map((r: unknown) => this.toEntity(r as InstitutionProps)),
      nextCursor: hasMore && lastId ? lastId : null,
      hasMore,
    }
  }

  async create(input: CreateInstitutionInput): Promise<Institution> {
    const row = await this.prisma.institution.create({
      data: {
        name: input.name,
        subdomain: input.subdomain.toLowerCase(),
        plan: input.plan ?? 'FREE',
        timezone: input.timezone ?? 'America/Argentina/Buenos_Aires',
        logoUrl: input.logoUrl ?? null,
      },
    })
    return this.toEntity(row as unknown as InstitutionProps)
  }

  async update(id: string, input: UpdateInstitutionInput): Promise<Institution> {
    const row = await this.prisma.institution.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.plan !== undefined ? { plan: input.plan } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
      },
    })
    return this.toEntity(row as unknown as InstitutionProps)
  }

  async deactivate(id: string): Promise<Institution> {
    const row = await this.prisma.institution.update({
      where: { id },
      data: { status: 'INACTIVE' as InstitutionStatus },
    })
    return this.toEntity(row as unknown as InstitutionProps)
  }

  async activate(id: string): Promise<Institution> {
    const row = await this.prisma.institution.update({
      where: { id },
      data: { status: 'ACTIVE' as InstitutionStatus },
    })
    return this.toEntity(row as unknown as InstitutionProps)
  }

  async updateLogo(id: string, logoUrl: string | null): Promise<Institution> {
    const row = await this.prisma.institution.update({
      where: { id },
      data: { logoUrl },
    })
    return this.toEntity(row as unknown as InstitutionProps)
  }

  toEntity(props: InstitutionProps): Institution {
    return Institution.fromPersistence(props)
  }
}
