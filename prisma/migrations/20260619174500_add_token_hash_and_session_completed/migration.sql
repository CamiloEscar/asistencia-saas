-- AlterEnum
ALTER TYPE "SessionStatus" ADD VALUE 'COMPLETED';

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN "tokenHash" VARCHAR(64);

-- CreateIndex (partial unique, no incluido en schema.prisma)
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key"
  ON "refresh_tokens" ("tokenHash")
  WHERE "tokenHash" IS NOT NULL;
