# Architecture

```text
React -> /api/sets -> Express -> JsonStore -> data/sets.json

Typing and scoring run in the browser. Express serves the frontend and API.
During development, Vite proxies /api to port 3000.
```

## Code

```text
src/App.tsx, Library.tsx:          navigation, preferences, saved sets.
src/SetPicker.tsx:                searchable, keyboard-accessible set selection.
src/Practice.tsx, useTyping.ts:    input, timing, results.
src/typing.ts, entry.ts:           targets, word locks, scoring, Unicode segmentation.
src/TypingText.tsx, styles.css:    text, caret, scrolling, layout.
src/api.ts:                       API requests.
server/:                          routes, validation, JSON storage, startup.
shared/types.ts:                  shared TypeScript types.
```

## API

```text
GET    /api/health
GET    /api/sets
POST   /api/sets
PUT    /api/sets/:id
DELETE /api/sets/:id

Create/update: { name, kind, content }; kind is passage or words.
Name: 1–100 characters. Content: 1–50,000. Both trimmed.
Sets include UUIDs and creation/update timestamps. Errors return { error }.
```
