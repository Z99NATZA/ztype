# softtype

## Stack

```text
Typing practice with saved passages and random word banks. Supports Thai and English.

Frontend: React / TypeScript / Tailwind CSS
Backend:  Express / JSON storage
Build:    Vite / Docker Compose / Make
```

## Run

```bash
# Requires Docker Compose and Make. Run from the project directory.

make run                          # http://localhost:8080
make down                         # Stop
make logs                         # View logs

# Saved sets stay in `data/sets.json` across restarts and rebuilds.
# Change the port with `PORT=8090 make run` or `.env` using `.env.example`.
```

## Development

```bash
# Requires Node.js 24+.

npm ci
make dev                          # Frontend :5173; API :3000
make test                         # Unit and API tests
make build                        # Type-check and build

# Browser tests require a running app
make run
npx playwright install chromium
npm run test:e2e
```

## [Documentation](docs/README.md)
