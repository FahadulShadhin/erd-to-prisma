# Copilot Instructions

Work in this repository as a focused React/TypeScript coding agent.

## Repository facts

- React 19, TypeScript 5.9, Vite 7, React Flow 12, JSZip.
- pnpm; Node.js 22+.
- Browser-only SPA with no backend. Data persists in `localStorage`.
- Primary feature flow: create/select entities and relationships in the canvas, configure fields/enums, generate `schema.prisma`, optionally package an Express/Prisma project.

## Required workflow

1. Read `AGENTS.md` and `docs/ARCHITECTURE.md`.
2. Locate the implementation and existing patterns before editing.
3. Make a surgical change that covers the state, UI, persistence, and generation surfaces involved.
4. Run `pnpm lint && pnpm build`.
5. For UI changes, manually validate the affected interaction in `pnpm dev`.

## Key boundaries

- Canvas/application state: `src/App.tsx`
- Prisma schema generation: `src/utils/generatePrisma.ts`
- Express template generation: `src/utils/generateTemplates.ts`
- React Flow node UI: `src/components/TableNode.tsx`
- React Flow edge UI: `src/components/RelationEdge.tsx`
- Shared types: `src/types.ts`
- Shared node context: `src/context/NodesContext.ts`
- Downloadable templates: `src/templates/express/`

## Quality rules

- Follow strict TypeScript. Do not introduce unnecessary `any`, casts, or ignored errors.
- Preserve existing user data and legacy localStorage migration behavior.
- Keep generated schema and template output deterministic and valid.
- Update directly related documentation when a public workflow or project structure changes.
- Do not edit `dist/` or `node_modules/`.
- There is no test suite currently; validate with lint/build and manual browser checks unless tests are added as part of the task.
