-- AlterTable
ALTER TABLE "Template" ADD COLUMN "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
