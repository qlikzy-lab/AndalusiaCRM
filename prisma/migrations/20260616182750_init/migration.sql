-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phoneNumber" TEXT,
    "phoneNumberNormalized" TEXT,
    "displayName" TEXT,
    "childName" TEXT,
    "childAge" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "source" TEXT NOT NULL,
    "screenshotFilenames" TEXT NOT NULL DEFAULT '[]',
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL,
    "rawExtraction" TEXT NOT NULL DEFAULT ''
);

-- CreateIndex
CREATE INDEX "Lead_phoneNumberNormalized_idx" ON "Lead"("phoneNumberNormalized");

-- CreateIndex
CREATE INDEX "Lead_displayName_idx" ON "Lead"("displayName");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");
