# ERD to Prisma

Create an entity relationship diagram in your browser and generate a Prisma
`schema.prisma` file from it.

![ERD to Prisma screenshot](public/Screenshot%202026-04-07%20at%2012.36.19%E2%80%AFAM.png)

## Requirements

- Node.js 22 or later
- pnpm
- Docker

## Run locally

1. Clone the repository and move into the project directory:

   ```bash
   git clone https://github.com/FahadulShadhin/erd-to-prisma.git
   cd erd-to-prisma
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start the Vite development server:

   ```bash
   pnpm dev
   ```

4. Open the local URL printed by Vite in your browser (usually
   [http://localhost:5173](http://localhost:5173)).

## Run the API locally

The Express API is a separate Node.js process in `server/`; PostgreSQL must be
available using the server's `DATABASE_URL`.

1. Configure these server-side environment variables in `server/.env`:
   `DATABASE_URL`, `SESSION_SECRET` (at least 32 characters),
   `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `APP_ORIGIN`,
   `API_ORIGIN`, and optionally `PORT` (defaults to `3001`) and `NODE_ENV`.
   Keep real credentials out of Git.
2. Register a GitHub OAuth app. Set its Homepage URL to the frontend URL and
   use this local callback URL:

   ```text
   http://localhost:3001/auth/github/callback
   ```

3. Apply the database migration and start the API:

   ```bash
   pnpm db:migrate
   pnpm dev:server
   ```

4. In a separate terminal, run `pnpm dev` for the frontend. The Vite
   development server proxies `/api` and `/auth` to the local API.

For production, deploy the API as a separate Node.js service and set
`VITE_API_BASE_URL` in Netlify to its public origin. Configure the GitHub OAuth
callback as `<API_ORIGIN>/auth/github/callback` and `APP_ORIGIN` as the frontend
origin. Prefer app/API custom domains on the same site so browser session
cookies work reliably.

## Run with Docker Compose

Docker Compose builds the frontend and serves it with Nginx. From the project
directory, run:

```bash
docker compose up --build
```

Open [http://localhost:8080](http://localhost:8080). To stop the app, press
`Ctrl+C`; if you started Compose in detached mode, run:

```bash
docker compose down
```

## Useful commands

```bash
pnpm dev       # Start the development server
pnpm build     # Type-check and create a production build in dist/
pnpm preview   # Preview the production build locally
pnpm lint      # Run ESLint
pnpm build:server # Build the Express API
pnpm db:migrate   # Apply PostgreSQL migrations
```

## Development documentation

- [Agent workflow guide](AGENTS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Development and smoke-test guide](docs/DEVELOPMENT.md)

## Credits

Vectors and icons by [SVG Repo](https://www.svgrepo.com).
