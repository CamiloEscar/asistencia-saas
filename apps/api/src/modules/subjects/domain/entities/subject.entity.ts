/**
 * Domain entity for a Subject (academic topic). Subjects are the
 * catalog of courses the institution offers (e.g., "MAT101 —
 * Matemática I"). They carry an institution-scoped UNIQUE code.
 */
export interface SubjectProps {
  id: string
  institutionId: string
  code: string
  name: string
  description: string | null
  createdAt?: Date
  updatedAt?: Date
  deletedAt?: Date | null
}

export class Subject {
  private constructor(private readonly props: SubjectProps) {}

  static fromPersistence(p: SubjectProps): Subject {
    return new Subject(p)
  }

  get id(): string {
    return this.props.id
  }
  get institutionId(): string {
    return this.props.institutionId
  }
  get code(): string {
    return this.props.code
  }
  get name(): string {
    return this.props.name
  }
  get description(): string | null {
    return this.props.description
  }
  get createdAt(): Date | undefined {
    return this.props.createdAt
  }
  get updatedAt(): Date | undefined {
    return this.props.updatedAt
  }

  toPublicJson(): {
    id: string
    code: string
    name: string
    description: string | null
  } {
    return {
      id: this.props.id,
      code: this.props.code,
      name: this.props.name,
      description: this.props.description,
    }
  }
}
