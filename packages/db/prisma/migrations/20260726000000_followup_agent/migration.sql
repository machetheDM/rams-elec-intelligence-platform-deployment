-- =============================================================================
-- Rams @Elec Intelligence Platform — Module 10: Post-Service Follow-up Agent
-- =============================================================================
-- Run: npx prisma migrate deploy
--
-- Adds:
--   1. follow_ups            — post-service check-in records; also the training
--                              set for the failure-recurrence model (Part E)
--   2. customers.follow_up_consent (+ _at)
--                            — POPIA per-purpose consent. Deliberately NOT
--                              reusing alert_subscribed, which is scoped to
--                              load-shedding alerts.
--   3. equipment.risk_score (+ _scored_at)
--                            — written by the failure-recurrence model once it
--                              has enough labelled follow-ups to train.
--
-- All three are additive and nullable/defaulted, so this migration is safe to
-- apply to a populated database without backfill.
-- =============================================================================

-- CONSENT + RISK SCORE COLUMNS

ALTER TABLE "customers" ADD COLUMN "follow_up_consent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customers" ADD COLUMN "follow_up_consent_at" TIMESTAMP(3);

ALTER TABLE "equipment" ADD COLUMN "risk_score" DOUBLE PRECISION;
ALTER TABLE "equipment" ADD COLUMN "risk_scored_at" TIMESTAMP(3);

-- FOLLOW-UP RECORDS

CREATE TABLE "follow_ups" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "equipment_id" TEXT,
    "days_since_completion" INTEGER NOT NULL,
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "response_received" BOOLEAN NOT NULL DEFAULT false,
    "responded_at" TIMESTAMP(3),
    "still_working" BOOLEAN,
    "satisfaction_rating" INTEGER,
    "comment_text" TEXT,
    "sentiment_score" DOUBLE PRECISION,
    "sentiment_themes" TEXT[],
    "follow_up_issue_created" BOOLEAN NOT NULL DEFAULT false,
    "follow_up_inquiry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "follow_ups_job_id_idx" ON "follow_ups"("job_id");
CREATE INDEX "follow_ups_response_received_idx" ON "follow_ups"("response_received");
CREATE INDEX "follow_ups_triggered_at_idx" ON "follow_ups"("triggered_at");
CREATE INDEX "follow_ups_still_working_idx" ON "follow_ups"("still_working");

-- FOREIGN KEY CONSTRAINTS

ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
