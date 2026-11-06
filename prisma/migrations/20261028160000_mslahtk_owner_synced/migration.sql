-- Which owner each file's Mslahtk lead was last given as assignee, so a change
-- of owner here is sent to Mslahtk once (lib/staff.ts). Additive: one nullable
-- column; every existing file reads as "never sent" and is brought in line by
-- the back-office sweep.

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN "mslahtkOwnerSynced" TEXT;
