ALTER TABLE "User" ADD COLUMN "captureToken" TEXT;
CREATE UNIQUE INDEX "User_captureToken_key" ON "User"("captureToken");
