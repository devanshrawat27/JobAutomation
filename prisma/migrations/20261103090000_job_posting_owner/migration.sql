-- Ownership for postings that exist only because one candidate supplied them.
-- Null means the row came from an employer's public board and is shared.
ALTER TABLE "JobPosting" ADD COLUMN "ownerUserId" TEXT;

CREATE INDEX "JobPosting_ownerUserId_idx" ON "JobPosting"("ownerUserId");

ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
