-- AlterTable
ALTER TABLE "Template" ADD COLUMN "accountId" TEXT;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
