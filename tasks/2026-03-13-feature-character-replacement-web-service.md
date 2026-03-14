# Feature: Character Replacement Web Service

Build a public beta website where users can upload a driving video + reference character image and generate character-replacement videos using the existing Wan2.2 Modal pipeline.

## Project Structure

```
character-replacement/
├── wan-modal/              # Existing — DO NOT modify (except minor CLI arg changes)
│   └── app.py              # Preprocess + inference Modal functions
├── site/
│   ├── frontend/           # React + Vite + shadcn/ui (TypeScript)
│   ├── backend/            # Express API (TypeScript)
│   ├── modal/              # Site-specific Modal functions (Python) — yt-dlp, file serving, etc.
│   └── shared/             # Shared TypeScript types (job status, API contracts, etc.)
```

- `wan-modal/` is stable and tested — leave it alone
- `site/` contains all new web service code
- Backend calls Modal functions via the official Modal TypeScript SDK (`npm install modal`)
  - Can invoke deployed Python functions and interact with volumes
  - Function definitions stay in Python (wan-modal)
- Site-specific Modal functions live in `site/modal/` (Python) — yt-dlp download, file serving, etc.

## Architecture

```
┌──────────────────────────────────────┐     ┌─────────────────────────┐
│  Railway                             │     │  Modal                  │
│  ┌────────────────────────────────┐  │     │                         │
│  │  Vite + Express (TypeScript)  │  │────▶│  wan-modal (Python)     │
│  │  React SPA  ←→  Express API   │  │◀────│  - Preprocess (A10G)    │
│  │  + Better Auth                │  │     │  - Inference (8xH200)   │
│  └────────────────────────────────┘  │     │                         │
│                                      │     │  site/modal (Python)    │
│  Turso (SQLite) ←── jobs, users      │     │  - yt-dlp download      │
│                                      │     │  - File serving endpoint │
└──────────────────────────────────────┘     └─────────────────────────┘
```

## Stack

- **Frontend**: React + Vite + shadcn/ui (TypeScript) — in `site/frontend/`
- **Backend**: Express (TypeScript) — in `site/backend/`, calls Modal via TS SDK
- **Auth**: Better Auth (Google OAuth only)
- **Database**: Turso (hosted SQLite)
- **Queue**: In-memory (simple array/queue in Express process)
- **GPU Inference**: Existing Modal app (wan-modal/app.py)
- **Notifications**: Email (Resend) or push notifications when video is done
- **Async Flow**: Job submitted → in-memory queue → sends to Modal → webhook callback → update Turso + notification sent

## What to Build

### 1. Express API

- `POST /api/jobs` — accept video file or URL (max 15s) + image upload, validate, insert as `queued` in Turso, return job ID. If URL provided, download via yt-dlp on Modal (cheap CPU function).
- `GET /api/jobs/:id` — return job status (queued / preprocessing / generating / done / failed) + output URL
- `GET /api/jobs` — list user's generation history
- `POST /api/webhooks/modal` — receive completion callback from Modal, update job in Turso, trigger notification
- Auth middleware via Better Auth
- File upload handling (stream to Modal volume or object storage)
- Rate limiting: 2 free generations per user (enforce before enqueuing). Payments for additional generations to be added later.

### 2. Job Queue (In-memory)

- Simple in-memory queue in the Express process (array or `p-queue`)
- Concurrency limit: **1 job at a time** — only process the next job when the current one finishes
- Job states tracked in Turso (queued → preprocessing → generating → done / failed) for persistence across page loads
- Note: queued jobs are lost on redeploy — acceptable for beta, drain queue before deploying

### 3. Modal Changes (wan-modal/app.py)

- Add webhook callback at end of inference (HTTP POST to Railway backend with job ID + status + output path)
- Ensure `preprocess` and `InferenceRunner.run` are callable via `modal.Function.lookup()`
- Consider `@modal.web_endpoint` for direct file upload to Modal volume (avoids double-hop for large videos)

### 4. Frontend Pages (React + Vite)

- **Login / Signup** — "Sign in with Google" button via Better Auth
- **Upload page** — video file or URL (downloaded via yt-dlp) + character image upload form, mode selection (replace/animate)
- **Job status page** — progress indicator, poll `/api/jobs/:id` for updates
- **Video page** (`/videos/:id`) — public, no auth required. Video player, download button, copy link to share. og:video meta tags for social previews.
- **History / dashboard** — list of user's past generations with thumbnails + status
- **Explore page** (`/explore`) — public gallery of all generated videos, no auth required

### 5. Notification System

When a video finishes generating:
- **In-app**: Update job status in Turso, frontend picks up on next poll
- **Email**: Send "Your video is ready!" email with link to viewer page (via Resend)
- **Browser push** (optional): Web Push API for real-time browser notifications

### 6. Sharing

- All videos are public at `/videos/:id`
- Copy-to-clipboard share button on the video page
- og:video meta tags for social previews

### 7. Output Storage

- **Modal volumes** — store input files and output videos on the existing `wan-io` volume
- Serve files via a Modal `@modal.web_endpoint` that reads from the volume and returns the video
- Used for both the video viewer page and shared video links

## Open Questions

- ~~Max concurrent generations per user during beta?~~ → 1 global concurrent job
- ~~File size / video length limits?~~ → 15 second max video length
- Custom domain?

## Build Order

1. Scaffold `site/` project structure (frontend, backend, modal, shared)
2. Set up `site/backend/` — Express + TypeScript, deploy to Railway
3. Set up `site/frontend/` — React + Vite + shadcn/ui, served by Express
4. Set up Turso database (users, jobs tables)
5. Integrate Better Auth (Google OAuth)
6. Build `site/modal/` — yt-dlp download function + file serving web endpoint
7. Build upload page (file + URL input, image upload, 15s limit validation)
8. Add in-memory job queue (1 concurrent) + connect to wan-modal via Modal TS SDK
9. Build job status page (polling) + video page (public, download, share link)
10. Add webhook callback from Modal → Express on job completion
11. Add email notifications via Resend
12. Build explore page (public gallery of all generated videos)
13. Build history/dashboard page (user's past generations)
14. Enforce 2 free generations per user limit
15. Add og:video meta tags for social sharing
16. Polish — error handling, loading states, edge cases
