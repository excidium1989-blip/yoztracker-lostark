# Yoztracker architecture

## Project

A German-language private Lost Ark raid tracker using React 19, TypeScript, TanStack Start/Router, Vite and Netlify. The index route renders the actual product. Every authenticated user administers only their own roster; there is no shared public roster or client-configured global administrator password.

## Key directories

- `src/routes/`: TanStack routes. `__root.tsx` owns German document metadata and global styles; `index.tsx` mounts the workspace.
- `src/components/`: workspace, authentication dialog, accessible modal and character/raid cards.
- `src/lib/raids.ts`: authoritative catalogue, Zod contracts, Top-4 selection, weekly reset and gold progress. Shared between client and server.
- `src/lib/useTracker.ts`: authentication hydration, owner-scoped state and independent ordered cache/cloud persistence queues.
- `src/lib/cache.ts`: AES-GCM LocalStorage cache with non-exportable IndexedDB device keys. A convenience cache, not authoritative persistence.
- `src/styles.css`: responsive Midnight Shadow styling, design tokens and reduced-motion support.
- `db/schema.ts`: Drizzle Postgres schema. `db/index.ts` lazily creates the Netlify Database client.
- `netlify/functions/`: modern `.mts` authenticated roster read/write and public lostark.bible import endpoints.
- `netlify/lib/auth.ts`: server-side Identity verification with a verified Identity endpoint fallback when framework request context is unavailable.
- `netlify/database/migrations/`: generated migrations applied by the platform.
- `public/icons/`: original SVG class assets extracted from public lostark.bible assets and tinted antique gold. `public/img/` contains the generated static banner.

## Rules and decisions

- Use `@netlify/identity`, never LocalStorage passwords or deprecated Identity widgets. The Identity activation script has been run.
- Use Netlify Database with `drizzle-orm@beta` and `drizzle-kit@beta` for server persistence. Do not introduce external databases or local JSON state. Every schema change requires a matching migration under `netlify/database/migrations`.
- Ownership comes exclusively from the verified session, never a browser-supplied owner ID. Mutations require same-origin requests and validated data. Never return another user's roster.
- Show at most four distinct eligible raid families, highest available mode only. Sort by required level descending, then catalogue order descending. Equal-level ties favor newer catalogue entries. Thresholds are explicit user-defined product rules, not inferred current game data.
- Keep the exact catalogue; exclude Vestiges of the End. Normal and hard modes share a weekly lockout and must not appear twice for one character.
- Gold selections are opt-in and capped at three. Aggregate progress counts selected gold raids only. Non-gold clears do not change the gold progress.
- Weekly reset is Wednesday 10:00 UTC. Reset completions only; preserve characters, links and gold choices. Normalize state when the week changes.
- Import only public HTTPS lostark.bible character roster URLs. No redirects, arbitrary hosts, executable scraped JavaScript or automatic-clear claims without explicit current-week data. Manual CRUD is the fallback.
- Cache writes must not wait for network writes. Only uploading the latest snapshot clears the pending marker. Never log tokens or roster payloads. Caches are owner-scoped and used only after session hydration.
- Last successful cloud write wins across devices; do not claim automatic conflict merging.
- Use TypeScript, named React components, descriptive variables, type-only imports and functional mutations. Add no inline code comments unless requested.
- Background `#020305`, panels `#0c0d12`, midnight-blue frames. Gold is for text and accents, never UI borders. Checked raids glow cyan. Preserve accessible keyboard interactions, mobile layouts and reduced-motion behavior.
- Do not run local builds, tests, type-checkers or dev servers during agent runs in this environment. The platform validates automatically. Installing dependencies and generating migrations are allowed.

## Local development for humans

Install with `pnpm install`, link the Netlify site, then use `netlify dev --port 8889`. See `README.md` for setup, security behavior and import limitations.
