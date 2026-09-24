ALTER TABLE users
  ADD COLUMN IF NOT EXISTS motto VARCHAR(80) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_online_at TIMESTAMP NULL;

ALTER TABLE avatar_appearances
  ADD COLUMN IF NOT EXISTS avatar_key ENUM('avatar-green','avatar-lime') NOT NULL DEFAULT 'avatar-green';

CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_expiry (expires_at),
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

