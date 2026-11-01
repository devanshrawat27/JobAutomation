-- AlterEnum
ALTER TYPE "DocumentKind" ADD VALUE 'RESUME';

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "documentEditedAt" TIMESTAMP(3),
ADD COLUMN     "profileHash" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "data" JSONB;
