-- v0.10.6: make catalog purchases safely retryable.
ALTER TABLE currency_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_currency_user_idempotency
  ON currency_transactions (user_id, idempotency_key);
