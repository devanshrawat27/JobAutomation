-- CreateEnum
CREATE TYPE "JobDecisionStatus" AS ENUM ('SAVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "JobDecision" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postingId" TEXT NOT NULL,
    "board" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "url" TEXT NOT NULL,
    "status" "JobDecisionStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobDecision_userId_status_idx" ON "JobDecision"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "JobDecision_userId_postingId_key" ON "JobDecision"("userId", "postingId");

-- AddForeignKey
ALTER TABLE "JobDecision" ADD CONSTRAINT "JobDecision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
