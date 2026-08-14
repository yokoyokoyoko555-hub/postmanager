-- AlterEnum
ALTER TYPE "DraftSource" ADD VALUE 'routine';

-- CreateEnum
CREATE TYPE "RoutineFrequency" AS ENUM ('daily', 'weekly');

-- CreateTable
CREATE TABLE "RoutinePost" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "frequency" "RoutineFrequency" NOT NULL DEFAULT 'weekly',
    "daysOfWeek" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "hour" INTEGER NOT NULL,
    "minute" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutinePost_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RoutinePost" ADD CONSTRAINT "RoutinePost_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
