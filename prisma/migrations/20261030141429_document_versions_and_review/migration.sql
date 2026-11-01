-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "previousId" TEXT,
ADD COLUMN     "review" JSONB;

-- CreateIndex
CREATE INDEX "Document_previousId_idx" ON "Document"("previousId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_previousId_fkey" FOREIGN KEY ("previousId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
