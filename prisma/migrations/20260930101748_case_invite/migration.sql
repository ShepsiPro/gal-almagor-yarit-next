-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "awaitingCustomer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "invitedAt" TIMESTAMP(3);
