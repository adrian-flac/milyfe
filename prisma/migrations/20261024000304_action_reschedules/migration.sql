-- CreateTable
CREATE TABLE "ActionReschedule" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionReschedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionReschedule_actionId_createdAt_idx" ON "ActionReschedule"("actionId", "createdAt");

-- AddForeignKey
ALTER TABLE "ActionReschedule" ADD CONSTRAINT "ActionReschedule_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;
