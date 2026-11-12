-- A player can carry several ids from one source: WMT issues a new player id per season (and per
-- roster), so the same person gets a fresh WMT id each year. The (source, external_id) UNIQUE
-- constraint stays, so one external id still points at exactly one player.
ALTER TABLE player_external_ids DROP CONSTRAINT player_external_ids_pkey;
CREATE INDEX player_external_ids_player_source ON player_external_ids (player_id, source);
