-- CreateTable
CREATE TABLE "sync_log" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT,
    "status" TEXT NOT NULL,
    "teamCount" INTEGER NOT NULL DEFAULT 0,
    "gameCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_log_createdAt_idx" ON "sync_log"("createdAt");

-- AddForeignKey
ALTER TABLE "sync_log" ADD CONSTRAINT "sync_log_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "season"("id") ON DELETE SET NULL ON UPDATE CASCADE;
