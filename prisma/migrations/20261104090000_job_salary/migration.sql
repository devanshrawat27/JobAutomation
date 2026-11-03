-- Pay as stated by the posting, normalised to lakhs per annum.
ALTER TABLE "JobPosting" ADD COLUMN "salaryMin" DOUBLE PRECISION;
ALTER TABLE "JobPosting" ADD COLUMN "salaryMax" DOUBLE PRECISION;
