# UNS · SSP Studio

A Vite + React (TypeScript) application for designing, translating, and validating Sonic Signaling Protocol (SSP) documents alongside UNS vector tooling. The UI layers on top of the local `uns-ssp` toolkit so linguists can move from prose → SSP lexemes → UNS audio previews without leaving the browser.

## Features

- **Workspace shell**: Sidebar navigation with route-level layout, persistent doc selector, and quick creation controls.
- **Editor**: Manage SSP/UNS field documents with live stats on lexeme coverage.
- **Translation Studio**: Runs `DomainToSspTranslator` against the demo proto-language model, surfacing utterance tokens, concept graphs, and role edges.
- **Analyzer**: Tracks lexeme dictionary growth plus translation history snapshots.
- **Audio Lab**: Plays generated performances via a lightweight Web Audio engine and displays per-track metrics.
- **UNS Tools**: MIX / MASK / CANCEL playground for domain scientists, powered by helper wrappers.
- **Help & Briefings**: Embedded quick-start summary pointing back to the markdown dossiers in the repo root.

## Getting Started

```bash
npm install          # install dependencies
npm run dev          # start Vite dev server (Node 20.19+ recommended)
npm run build        # type-check + production bundle
npm run preview      # preview the production build locally
npm run test         # run Vitest (jsdom environment, setup via vitest.setup.ts)
npm run lint         # eslint flat config
```

A VS Code task (`npm: build`) is available if you prefer `Terminal → Run Task…`.

## Project Notes

- State lives in `src/state/useWorkspaceStore.ts` (Zustand). Routes read/write shared docs, dictionary, and translation history.
- Toolkit access sits in `src/lib` (demo model, translator wiring, UNS vector helpers, audio engine).
- Routing is defined in `src/router.tsx` with metadata in `src/routes/routeMeta.ts` to keep layout navigation in sync.
- Styling relies on Tailwind; see `tailwind.config.ts` for palette tweaks and `src/index.css` for base directives.
- Tests pick up configuration from `vitest.config.ts`, mirroring the Vite alias/plugins so component tests can import via `@/...` paths.

## Requirements

- Node.js 20.19 or newer (Vite 6 requirement)
- npm 10+

With those in place, `npm run dev` will boot the SPA at `http://localhost:5173` and hot-reload each route as you iterate.
