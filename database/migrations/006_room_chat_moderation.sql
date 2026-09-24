-- Persistent room chat archive for future moderation and admin tooling.
-- Messages remain tied to the room and retain a sender snapshot so records
-- stay useful even if a username or account is later changed.
CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  room_public_id CHAR(36) NOT NULL,
  sender_user_id BIGINT UNSIGNED NULL,
  sender_name VARCHAR(20) NOT NULL,
  message VARCHAR(160) NOT NULL,
  moderation_status ENUM('visible','hidden','flagged') NOT NULL DEFAULT 'visible',
  moderation_note VARCHAR(255) NULL,
  moderated_by_user_id BIGINT UNSIGNED NULL,
  moderated_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chat_room_time (room_public_id, created_at),
  INDEX idx_chat_sender_time (sender_user_id, created_at),
  CONSTRAINT fk_chat_sender FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_chat_moderator FOREIGN KEY (moderated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
