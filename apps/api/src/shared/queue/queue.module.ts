import { Global, Injectable, Logger, Module, type OnModuleDestroy } from '@nestjs/common'
import { Queue, Worker, type Processor } from 'bullmq'

// Imported lazily inside the factory to avoid a TS type-declaration
// clash between BullMQ's bundled ioredis and the main app's ioredis.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RedisCtor = require('ioredis') as new (url: string, opts: Record<string, unknown>) => unknown

/**
 * DI tokens for the BullMQ Queue and the Redis client that backs
 * it. The queue lives on the `REDIS_BULLMQ_DB` logical DB (default
 * 3) so it's isolated from the cache / throttler (DB 0), the
 * refresh-token store (DB 1), and the activation-token store (DB 2).
 *
 * Note: the BullMQ client (`BULLMQ_REDIS`) is typed as `unknown`
 * because the `ioredis` version pulled in by `bullmq` does not
 * match the version pulled in by the main app. The runtime objects
 * are compatible — this is a TS declaration mismatch only. Cast
 * to `Redis` at the usage site if you need a typed reference.
 */
export const BULLMQ_QUEUE = Symbol('BULLMQ_QUEUE')
export const BULLMQ_REDIS = Symbol('BULLMQ_REDIS')

/** Re-declared locally so downstream code doesn't need to import
 *  `ioredis` directly (avoiding the version-conflict in TS). */
export type BullmqConnection = unknown

/** Names of every queue the app uses. Centralized so we can
 *  discover the surface area in one place. */
export const QUEUE_NAMES = {
  STUDENT_BULK_IMPORT: 'student-bulk-import',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]

/**
 * QueueLifecycle — owns the lifecycle of any Workers registered
 * with the app. Feature modules call `registerWorker(name, processor)`
 * in their `onModuleInit`; we close them all on shutdown.
 */
@Injectable()
export class QueueLifecycle implements OnModuleDestroy {
  private readonly logger = new Logger(QueueLifecycle.name)
  private readonly workers: Worker[] = []

  /** Register a worker for the given queue. The Worker is started
   *  immediately and added to the lifecycle for shutdown. */
  registerWorker(name: string, processor: Processor, client: unknown): Worker {
    const worker = new Worker(name, processor, {
      connection: client as never,
      prefix: 'asistencia',
      concurrency: 2,
    })
    worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} on ${name} failed: ${err.message}`)
    })
    worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} on ${name} completed`)
    })
    this.workers.push(worker)
    return worker
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()))
  }
}

/**
 * Generic QueueModule — registers a single Redis client on the
 * BullMQ logical DB, plus a default Queue. Feature modules register
 * their own Workers (see `student-bulk-import.processor.ts`).
 */
@Global()
@Module({
  providers: [
    {
      provide: BULLMQ_REDIS,
      useFactory: () => {
        const db = Number(process.env.REDIS_BULLMQ_DB ?? 3)
        const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
        return new RedisCtor(url, {
          db,
          lazyConnect: true,
          maxRetriesPerRequest: null, // required by BullMQ
        })
      },
    },
    {
      provide: BULLMQ_QUEUE,
      useFactory: (client: unknown) => {
        // A single shared Queue instance per app process. Workers
        // register separately. The `prefix` namespaces the keys so
        // multiple environments can share a Redis (dev/staging/prod).
        return new Queue('default', {
          connection: client as never,
          prefix: 'asistencia',
        })
      },
      inject: [BULLMQ_REDIS],
    },
    QueueLifecycle,
  ],
  exports: [BULLMQ_QUEUE, BULLMQ_REDIS, QueueLifecycle],
})
export class QueueModule {}

// Re-export Queue + Worker types for downstream modules.
export { Queue, Worker } from 'bullmq'
export type { Processor, Job } from 'bullmq'
