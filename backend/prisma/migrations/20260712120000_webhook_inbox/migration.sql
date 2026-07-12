-- Webhook Inbox (idempotence + traçabilité)
CREATE TABLE "webhook_inbox" (
    "id" VARCHAR(60) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "aggregate_type" VARCHAR(60) NOT NULL,
    "aggregate_id" VARCHAR(60) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PROCESSED',
    "error_message" VARCHAR(500),
    "processed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_inbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "webhook_inbox_event_type_idx" ON "webhook_inbox"("event_type");
CREATE INDEX "webhook_inbox_processed_at_idx" ON "webhook_inbox"("processed_at");
