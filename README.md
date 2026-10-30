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
```

## Credits

Vectors and icons by [SVG Repo](https://www.svgrepo.com).
