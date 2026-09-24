ALTER TABLE avatar_appearances
  MODIFY COLUMN avatar_key ENUM('avatar-green','avatar-lime','avatar-purple','avatar-coral','avatar-midnight','avatar-sunset')
  NOT NULL DEFAULT 'avatar-green';

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS layout_key VARCHAR(32) NOT NULL DEFAULT 'square-10',
  ADD COLUMN IF NOT EXISTS max_visitors TINYINT UNSIGNED NOT NULL DEFAULT 25;

CREATE TABLE IF NOT EXISTS room_visits (
  user_id BIGINT UNSIGNED NOT NULL,
  room_id BIGINT UNSIGNED NOT NULL,
  last_visited_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, room_id),
  INDEX idx_room_visits_recent (user_id, last_visited_at),
  CONSTRAINT fk_visit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_visit_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO rooms (public_id, owner_user_id, name, description, width, height, access_mode, layout_key, max_visitors)
SELECT '00000000-0000-4000-8000-000000000001', NULL, 'The Sunken Lounge',
  'Greenroom’s original low-lit community lounge.', 10, 10, 'public', 'square-10', 40
WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE public_id = '00000000-0000-4000-8000-000000000001');

INSERT INTO furniture_catalog (code, name, footprint_width, footprint_height, stack_height, asset_key, price_coins, enabled) VALUES
  ('moss-seat', 'Moss Lounge Chair', 1, 1, 1, 'moss-seat', 85, TRUE),
  ('amber-lamp', 'Amber Glow Lamp', 1, 1, 2, 'amber-lamp', 60, TRUE),
  ('cloud-table', 'Cloudglass Table', 2, 1, 1, 'cloud-table', 120, TRUE),
  ('vinyl-stack', 'Late-Night Vinyl Stack', 1, 1, 1, 'vinyl-stack', 45, TRUE),
  ('fern-planter', 'Moon Fern Planter', 1, 1, 2, 'fern-planter', 70, TRUE),
  ('plum-rug', 'Plum Orbit Rug', 2, 2, 0, 'plum-rug', 95, TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), price_coins = VALUES(price_coins), enabled = VALUES(enabled);
