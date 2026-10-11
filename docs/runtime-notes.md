# Runtime Notes

## Storage

```text
Docker mounts ./data at /app/data. Missing sets.json creates example sets.
Invalid existing data prevents startup without overwriting the file.
Writes use a queue and atomic rename. Run one server per data file.
Stop all writers before backup, restore, or manual edits.
```

```bash
make down
cp data/sets.json data/sets.backup.json
make run

# Restore: stop the app and copy the backup over data/sets.json.
```

## Configuration

```text
PORT:        Docker host port 8080; local API port 3000.
HOST:        Docker host address 127.0.0.1; use 0.0.0.0 for LAN access.
DATA_DIR:    local storage directory; default data.
BASE_URL:    browser test address; default http://127.0.0.1:8080.
CHROME_PATH: optional installed browser executable for tests.

Compose reads .env; local npm commands do not.
The API has no authentication; anyone with access can edit sets.
```

## Input and Rendering

```text
Input commits after IME composition and normalizes to NFC.
Incremental segmentation updates the changed suffix; word boundaries lock the prefix.
Text uses memoized chunks. One animation loop moves the caret and scroll;
reduced motion snaps both. Keep the hidden textarea unwrapped to avoid costly layout.
```
