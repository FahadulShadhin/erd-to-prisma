# Development Guide

## Prerequisites

- Node.js 22 or later
- pnpm
- Docker and Docker Compose only for container validation

## Local workflow

```bash
pnpm install
pnpm dev
pnpm lint
pnpm build
```

The Vite development server normally runs at `http://localhost:5173`.

For a production build preview:

```bash
pnpm build
pnpm preview
```

For container validation:

```bash
docker compose up --build
```

Open `http://localhost:8080`, then stop with `docker compose down`.

## Manual feature smoke tests

### Accounts and diagram persistence

1. Sign in with GitHub and confirm the account's server diagrams load before
   the canvas is shown.
2. Create, edit, rename, and delete a diagram; reload and confirm the changes
   are still present.
3. Sign out and confirm the account's diagrams are no longer shown.
4. Sign in as another account and confirm it only sees its own diagrams.
5. If legacy browser diagrams exist, import selected diagrams and verify the
   originals remain unchanged.
6. Temporarily make the API unavailable and confirm a user-scoped cache is
   clearly marked offline; without a cache, the app offers retry instead of
   showing an empty account workspace.

### Canvas and entities

1. Create a diagram and confirm it is selectable; signed-in diagrams save to
   the account, while signed-out diagrams remain temporary.
2. Drag an Entity onto the canvas.
3. Rename the entity and add/remove fields.
4. Configure primary key, nullable, unique, and field type values.
5. Create an enum and assign it to a field.
6. Delete the enum and confirm dependent fields return to `String`.
7. Delete the entity and confirm incident edges are removed.

### Relationships

1. Connect one entity to another.
2. Open the relation selector and verify `1:1`, `1:N`, and `N:N`.
3. Reconnect an existing edge.
4. Generate Prisma output and confirm the relation fields, foreign key, and cardinality match the selector.

### Prisma output

1. Generate a schema with at least one primary key.
2. Copy and download `schema.prisma`.
3. Verify referenced enums are included and unused enums are omitted.
4. Generate Express JS and Express TS zip archives.
5. Confirm the archive contains `package.json`, `prisma/schema.prisma`, source entry points, routes, controllers, services, and middleware.

### Persistence and themes

1. Reload while signed in and confirm cloud diagrams and the local theme persist.
2. Create, rename, switch, and delete diagrams.
3. Confirm local diagram data is offered for explicit import and never replaces
   cloud data automatically.

## Before submitting

- `pnpm lint`
- `pnpm build`
- Relevant manual smoke test
- Review the diff for generated or dependency artifacts
