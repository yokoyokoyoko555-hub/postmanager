-- AlterTable
ALTER TABLE "RoutinePost" ADD COLUMN "templateId" TEXT;
ALTER TABLE "RoutinePost" ADD COLUMN "endDate" DATE;

-- AddForeignKey
ALTER TABLE "RoutinePost" ADD CONSTRAINT "RoutinePost_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
