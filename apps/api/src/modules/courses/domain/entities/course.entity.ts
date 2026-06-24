/**
 * Domain entity for a Course. A course is an offering of a
 * subject for a specific semester (e.g., "MAT101 — Matemática I,
 * 2026-1"). It carries:
 *   - a `subjectId` FK
 *   - a `schedule` JSONB
 *   - a `defaultSessionDurationMin` (defaults to 80)
 *   - m:n relationships with teachers (`CourseTeacher`) and
 *     students (`Enrollment`)
 */
export interface CourseProps {
  id: string
  subjectId: string
  code: string
  name: string
  description: string | null
  semester: string
  startDate: Date
  endDate: Date
  schedule: unknown // validated by ScheduleVO at the use case layer
  defaultSessionDurationMin: number
  createdAt?: Date
  updatedAt?: Date
  deletedAt?: Date | null
}

export class Course {
  private constructor(private readonly props: CourseProps) {}

  static fromPersistence(p: CourseProps): Course {
    return new Course(p)
  }

  get id(): string {
    return this.props.id
  }
  get subjectId(): string {
    return this.props.subjectId
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
  get semester(): string {
    return this.props.semester
  }
  get startDate(): Date {
    return this.props.startDate
  }
  get endDate(): Date {
    return this.props.endDate
  }
  get schedule(): unknown {
    return this.props.schedule
  }
  get defaultSessionDurationMin(): number {
    return this.props.defaultSessionDurationMin
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
    semester: string
    subjectId: string
    startDate: Date
    endDate: Date
    schedule: unknown
    defaultSessionDurationMin: number
  } {
    return {
      id: this.props.id,
      code: this.props.code,
      name: this.props.name,
      description: this.props.description,
      semester: this.props.semester,
      subjectId: this.props.subjectId,
      startDate: this.props.startDate,
      endDate: this.props.endDate,
      schedule: this.props.schedule,
      defaultSessionDurationMin: this.props.defaultSessionDurationMin,
    }
  }
}
