-- Add a "received" flag to Invoice so purchases only move stock into a
-- warehouse once the goods are received. Existing rows default to received.
ALTER TABLE "Invoice" ADD COLUMN "received" BOOLEAN NOT NULL DEFAULT true;
