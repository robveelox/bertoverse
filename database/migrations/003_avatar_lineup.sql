ALTER TABLE avatar_appearances
  MODIFY COLUMN avatar_key ENUM('avatar-green','avatar-lime','avatar-purple','avatar-coral')
  NOT NULL DEFAULT 'avatar-green';
