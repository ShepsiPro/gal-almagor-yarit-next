-- Each employee gets their own files: who owns a customer's file, who it was
-- shared with, and the agency's people as Mslahtk lists them (lib/staff.ts).

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "ownerId" TEXT;

-- CreateTable
CREATE TABLE "SubmissionShare" (
    "submissionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sharedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionShare_pkey" PRIMARY KEY ("submissionId","userId")
);

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'unknown',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "syncedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubmissionShare_userId_idx" ON "SubmissionShare"("userId");

-- CreateIndex
CREATE INDEX "Submission_ownerId_createdAt_idx" ON "Submission"("ownerId", "createdAt");

-- AddForeignKey
ALTER TABLE "SubmissionShare" ADD CONSTRAINT "SubmissionShare_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A form the agency already sent says who sent it: that person owns the file.
UPDATE "Submission"
SET "ownerId" = "source"->>'agencyId'
WHERE "parentId" IS NULL
  AND "ownerId" IS NULL
  AND jsonb_typeof("source") = 'object'
  AND COALESCE("source"->>'agencyId', '') NOT IN ('', 'unknown');

-- A correction the customer filed from a re-sent link stays with the file it updates.
UPDATE "Submission" AS s
SET "ownerId" = p."ownerId"
FROM "Submission" AS p
WHERE s."resentFromId" = p."id"
  AND s."parentId" IS NULL
  AND s."ownerId" IS NULL
  AND p."ownerId" IS NOT NULL;
