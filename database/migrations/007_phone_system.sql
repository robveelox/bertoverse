-- Bertoverse phone foundation: live private messages and HQ announcements.
CREATE TABLE IF NOT EXISTS private_messages (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  sender_user_id BIGINT UNSIGNED NOT NULL,
  recipient_user_id BIGINT UNSIGNED NOT NULL,
  sender_name VARCHAR(20) NOT NULL,
  recipient_name VARCHAR(20) NOT NULL,
  message VARCHAR(160) NOT NULL,
  room_public_id CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  INDEX idx_private_sender_time (sender_user_id, created_at),
  INDEX idx_private_recipient_time (recipient_user_id, created_at),
  CONSTRAINT fk_private_sender FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_private_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS hq_updates (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  slug VARCHAR(80) NOT NULL UNIQUE,
  title VARCHAR(100) NOT NULL,
  body VARCHAR(500) NOT NULL,
  tone ENUM('info','notice','alert') NOT NULL DEFAULT 'info',
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_by_user_id BIGINT UNSIGNED NULL,
  INDEX idx_hq_published (pinned, published_at),
  CONSTRAINT fk_hq_author FOREIGN KEY (published_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT INTO hq_updates (slug, title, body, tone, pinned)
VALUES
  ('welcome-to-bertoverse', 'Welcome to Bertoverse', 'The lounge is open. Explore rooms, meet people and make yourself at home.', 'info', TRUE),
  ('room-chat-release', 'Room chat is live', 'Chat bubbles now float through the room and conversations are archived safely for future moderation tools.', 'notice', FALSE),
  ('phone-preview', 'Your phone has arrived', 'Messages, HQ updates and more social tools will keep landing here as Bertoverse grows.', 'info', FALSE)
ON DUPLICATE KEY UPDATE title = VALUES(title), body = VALUES(body), tone = VALUES(tone), pinned = VALUES(pinned);
