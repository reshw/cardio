ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS mileage_hide_from_day smallint CHECK (mileage_hide_from_day BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS mileage_hide_to_day   smallint CHECK (mileage_hide_to_day   BETWEEN 1 AND 31);
