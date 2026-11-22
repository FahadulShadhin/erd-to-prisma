# Agent Workflow Guide

## Start here

- This is a client-only React 19 + TypeScript + Vite application.
- Package manager: pnpm. Node.js 22+ is required.
- Canonical entry point: `src/App.tsx`.
- The app uses `@xyflow/react` for diagram editing and `localStorage` for persistence; it has no backend or database.
- Before editing, read `docs/ARCHITECTURE.md` and the smallest relevant implementation file.

## Fast setup

```bash
pnpm install
pnpm dev
```

Open the Vite URL, normally `http://localhost:5173`.

## Required validation

Run the smallest relevant check, then the project-wide checks before finishing:

```bash
pnpm lint
pnpm build
```

There is currently no automated test runner or test directory. Do not claim tests pass unless tests are added and run. For UI changes, manually verify the relevant browser flow as well.

Use `pnpm preview` after `pnpm build` to inspect a production build locally.

## Change routing

| Task | Start in |
| --- | --- |
| Diagram state, switching/creating diagrams, persistence | `src/App.tsx` |
| Diagram sidebar, Prisma generation trigger, diagram actions | `src/components/Sidebar.tsx` |
| Entity node rendering and field controls | `src/components/TableNode.tsx` |
| Field type/enum dropdown behavior | `src/components/TypeDropdown.tsx` |
| Enum creation and enum values | `src/components/EnumModal.tsx` |
| Relation rendering and relation selection | `src/components/RelationEdge.tsx` |
| ERD to Prisma conversion | `src/utils/generatePrisma.ts` |
| Prisma schema to generated Express project | `src/utils/generateTemplates.ts` |
| Shared template files | `src/templates/express/` |
| Download/copy Prisma UI | `src/components/PrismaModal.tsx` |
| Download template UI | `src/components/TemplateModal.tsx` |
| Shared types/context | `src/types.ts`, `src/context/NodesContext.ts` |
| Styling | `src/App.css`, `src/index.css`, `src/components/styles/main.css` |

## Implementation rules

- Preserve strict TypeScript behavior. Prefer explicit types and existing shared types over `any`.
- Keep changes localized. The app intentionally has a compact structure without a framework-specific state library.
- React state and callback propagation are currently coordinated between `src/App.tsx` and `NodesContext`; update both sides when adding shared node behavior.
- React Flow nodes and edges must keep their existing shape unless the data model and both persistence and generation code are updated together.
- `generatePrismaSchema` is the source of truth for ERD-to-Prisma behavior. Keep generated Prisma identifiers and relation directions predictable.
- Enum names and enum values are sanitized by `EnumModal`. Preserve valid identifier behavior in generated schemas.
- Browser persistence changes must remain backward-compatible with existing `erd-to-prisma:diagrams` data and the legacy `erd-to-prisma:flow` migration.
- The app is browser-only. Do not introduce server assumptions or environment variables outside the generated project boundaries.
- Template generation performs npm registry lookups for dependency versions. Keep `generateTemplates.ts` usable when network/package lookups fail by retaining its template/fallback behavior.
- Do not edit or build generated template contents under `src/templates/express/` unless the requested change is specifically for the downloadable Express template.
- Avoid unrelated formatting or dependency upgrades.

## Completion checklist

1. Read the relevant architecture and implementation sections.
2. Inspect existing similar behavior before adding new logic.
3. Add or update focused automated coverage if a test framework is part of the change.
4. Run `pnpm lint`.
5. Run `pnpm build`.
6. For visual or interaction changes, manually verify in the browser at desktop size and check the affected modal/dropdown/node behavior.
7. Check `git diff --stat` and `git diff` for unintended files or broad formatting changes.
