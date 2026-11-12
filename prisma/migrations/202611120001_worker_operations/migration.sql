CREATE TABLE "WorkerHeartbeat" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "stoppedAt" TIMESTAMP(3)
);
CREATE INDEX "WorkerHeartbeat_lastSeenAt_idx" ON "WorkerHeartbeat"("lastSeenAt");
CREATE INDEX "BackgroundJob_finishedAt_idx" ON "BackgroundJob"("finishedAt");
