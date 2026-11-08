CREATE TABLE IF NOT EXISTS users (
    user_id text PRIMARY KEY,
    username text NOT NULL UNIQUE,
    display_name text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL CHECK (role IN ('staff', 'admin'))
);

CREATE TABLE IF NOT EXISTS inventory (
    item_id text PRIMARY KEY CHECK (item_id ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
    name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    available integer NOT NULL CHECK (available BETWEEN 0 AND 1000000)
);

CREATE TABLE IF NOT EXISTS reservations (
    reservation_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    item_id text NOT NULL REFERENCES inventory (item_id),
    user_id text NOT NULL REFERENCES users (user_id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reservations_user_recent
    ON reservations (user_id, created_at DESC, reservation_id DESC);
CREATE INDEX IF NOT EXISTS reservations_item
    ON reservations (item_id);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL
);
