-- 既存のレポート(全アカウント合算方式)はアカウント単位に紐付け直せないためリセットする
TRUNCATE TABLE "DailyReport";

-- DropIndex
DROP INDEX "DailyReport_reportDate_key";

-- AlterTable
ALTER TABLE "DailyReport" ADD COLUMN "accountId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_reportDate_accountId_key" ON "DailyReport"("reportDate", "accountId");

-- AddForeignKey
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
