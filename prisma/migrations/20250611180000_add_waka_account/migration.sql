-- AlterTable
ALTER TABLE "User" ADD COLUMN "defaultAccount" TEXT;

-- CreateTable
CREATE TABLE "WakaAccount" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiBaseUrl" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "wakaUsername" TEXT,
    "wakaUserId" TEXT,

    CONSTRAINT "WakaAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WakaAccount_userId_name_key" ON "WakaAccount"("userId", "name");
