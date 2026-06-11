-- AlterTable
ALTER TABLE "User" ADD COLUMN "wakaUserId" TEXT;

-- CreateTable
CREATE TABLE "DigestConfig" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DigestConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalRole" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "targetHours" INTEGER NOT NULL,
    "range" TEXT NOT NULL DEFAULT 'all_time',

    CONSTRAINT "GoalRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DigestConfig_guildId_key" ON "DigestConfig"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalRole_guildId_range_targetHours_key" ON "GoalRole"("guildId", "range", "targetHours");
