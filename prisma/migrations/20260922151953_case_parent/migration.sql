-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "Submission_parentId_idx" ON "Submission"("parentId");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
