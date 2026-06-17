import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';

/**
 * Generic Zod validation pipe. Accepts a Zod schema in the route metadata
 * (set via `ZodValidationPipe.create(schema)`) and validates `body`, `query`,
 * or `params` against it.
 *
 * On failure, throws a `BadRequestException` with RFC 7807-compatible
 * `errors[]` array (`{ field, message }`).
 *
 * Usage:
 *   @Post()
 *   create(@Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserDto) { ... }
 *
 * Or, registered globally as APP_PIPE, by attaching the schema via custom
 * decorator + interceptor. For per-route use, the inline form is simpler.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodSchema) {}

  static create<T>(schema: ZodSchema<T>): ZodValidationPipe {
    return new ZodValidationPipe(schema);
  }

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    if (!this.schema) {
      // No schema attached — pass through. Use class-validator ValidationPipe
      // for DTO-level validation; this pipe only enforces Zod schemas.
      return value;
    }

    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        error: 'Unprocessable Entity',
        errors: this.formatZodError(result.error),
      });
    }
    return result.data;
  }

  private formatZodError(error: ZodError): Array<{ field: string; message: string }> {
    return error.issues.map((issue) => ({
      field: issue.path.join('.') || '(root)',
      message: issue.message,
    }));
  }
}
