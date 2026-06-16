-- Extensions required by the app.
-- pgcrypto: gen_random_uuid()
-- citext: case-insensitive email / legajo
-- pg_trgm: trigram indexes for ILIKE search on fullName / email / name
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
