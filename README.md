# ticklist

A personal lead climbing training log. Track sessions, routes, fingerboard work, limit bouldering, and strength training. Watch your progress over time.

Built for self-hosting on a homelab — single Docker container, SQLite, no accounts.

![screenshot placeholder]

## Features

- **Session logging** — log bit by bit during a session, not all at once
- **Lead routes** — Ewbank (AU), YDS, and French grades; onsight / flash / redpoint / working / top-rope
- **Limit bouldering** — V-scale, send or project
- **Fingerboard** — edge size, added weight, hang duration, sets
- **Strength** — weighted pull-ups, lock-offs, front lever, etc.
- **Warmup & stretching** — log your routine per session
- **Photos** — attach photos to any route or boulder entry
- **Progress charts** — max grade and max weight over time

## Running locally

### Prerequisites

- Python 3.12+
- Node 22+

### Backend

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The dev server proxies `/api` to the backend on port 8000.

## Deploying with Docker

```bash
docker compose up -d --build
```

The app runs on port `8000`. The SQLite database and uploaded photos are stored in a named Docker volume (`climbing-data`) so they survive container restarts and rebuilds.

To expose it on your local network, point your router or reverse proxy at port `8000` on the Docker host.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./climbing.db` | SQLite path |
| `PHOTOS_DIR` | `./photos` | Directory for uploaded photos |

## Deploying as a Portainer stack (Synology NAS)

The repo ships a prebuilt image to GitHub Container Registry, so the NAS just
pulls it — no building on the Synology.

**1. Publish the image (one time).** Pushing to `main` runs
`.github/workflows/docker-publish.yml`, which builds and pushes
`ghcr.io/andyroo91/sendlog:latest`. After the first successful run, the image
appears under your GitHub profile → Packages.

**2. Make the package pullable.** Easiest: open the `sendlog` package on GitHub
→ Package settings → Change visibility → **Public**. (Or keep it private and add
a GHCR registry in Portainer → Registries, using a GitHub PAT with the
`read:packages` scope.)

**3. Create the host folder for data.** In File Station make e.g.
`/volume1/docker/sendlog/data`. The SQLite DB and photos live here and persist
across redeploys.

**4. Add the stack in Portainer.** Stacks → Add stack → Web editor, paste
[`docker-compose.ghcr.yml`](docker-compose.ghcr.yml), edit the bind-mount host
path to match step 3, then Deploy. (Or use a Repository stack pointing at this
file.)

**5. Updating.** Push to `main` → the Action publishes a new `:latest` → in
Portainer, **Pull and redeploy** the stack.

The app listens on port `8000`; point your UniFi gateway / reverse proxy there.

## Tech stack

- **Backend** — Python, FastAPI, SQLAlchemy, SQLite
- **Frontend** — React, TypeScript, Vite, Recharts
- **Deployment** — Docker, single container
