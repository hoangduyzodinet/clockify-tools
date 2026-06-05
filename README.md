# Clockify Tools

A Next.js web app that turns your GitHub commits into Clockify time entries — with optional AI-powered title generation and smart scheduling.

## How it works

1. **Fetch** — pull commits from one or more GitHub repos for a date range
2. **Review** — commits are converted into draft tasks with scheduled start/end times
3. **Enhance** (optional) — use AI to rename titles or group related commits into summarised tasks
4. **Sync** — push the selected tasks to Clockify as time entries

## Prerequisites

- Node.js 18+
- A [Clockify](https://clockify.me) account
- A GitHub personal access token (read access to repos)
- (Optional) An OpenAI or Google Gemini API key for AI features

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser, then go to **Settings** to configure your API keys.

## Configuration

All settings are stored in browser `localStorage` — nothing is sent to a server except the API calls you trigger.

### GitHub

| Field | Description |
|---|---|
| **GitHub Token** | Personal access token with `repo` (read) scope |
| **Repositories** | One or more `owner/repo` pairs to fetch commits from |

### Clockify

| Field | How to find it |
|---|---|
| **API Key** | Profile settings → API → Personal API key |
| **Workspace ID** | Settings → Workspaces → click the workspace → copy ID from URL |
| **Project ID** | (Optional) Pre-selects a project when syncing |
| **User ID** | Filled automatically after entering API key |

### AI Provider (optional)

Choose **OpenAI** or **Gemini** and enter the corresponding API key and model name. Defaults:

- OpenAI: `gpt-4o-mini`
- Gemini: `gemini-2.5-flash`

If no AI key is configured, the AI buttons are hidden and commit messages are used as task titles directly.

### Scheduling

| Setting | Description |
|---|---|
| **Work day start / end** | Hours used when calculating task time slots (e.g. `09:00` – `18:00`) |
| **Schedule mode** | `byDate` — slots on the commit's actual date; `fillWeek` — distributes tasks across the week |
| **Work days** | Days of the week that count as working days (Mon–Fri by default) |
| **Min task duration** | Tasks shorter than this (minutes) are stretched to fill the minimum |
| **Filter merge commits** | Skip merge commits when fetching (recommended) |

## Main workflow

### Step 1 — Fetch commits

1. Fill in at least one repository (`owner` / `repo`)
2. Set the date range (defaults to the last 7 days)
3. Optionally filter by GitHub username or email
4. Click **Fetch Commits**

Commits are sorted newest-first and converted into draft tasks automatically.

### Step 2 — Review & edit tasks

Each commit becomes a task row. You can:

- Edit the **title** inline
- Adjust the **start / end** datetime
- **Deselect** rows you don't want to sync
- Use **Select all / Deselect all** for bulk actions

#### AI actions (requires AI key)

| Button | What it does |
|---|---|
| **Rename Titles** | Asks the AI to write a clean title for each individual commit |
| **Group & Summarize** | Groups related commits into fewer tasks and distributes them across the schedule range |

For **Group & Summarize**, set the schedule range below the buttons. The number of output tasks equals the number of working days in that range (capped by commit count).

### Step 3 — Sync to Clockify

Click **Sync N tasks to Clockify**. Each selected task is created as a time entry. Results appear inline:

- **✓ synced** — entry created successfully
- **✗ failed** — hover to see the error message

## Development

```bash
npm run dev        # start dev server (http://localhost:3000)
npm run build      # production build
npm run typecheck  # TypeScript check
npm run lint       # ESLint
npm run format     # Prettier (write)
npm run format:check  # Prettier (check only)
```

## Tech stack

- [Next.js](https://nextjs.org) (App Router)
- [Tailwind CSS](https://tailwindcss.com)
- [OpenAI SDK](https://github.com/openai/openai-node) / [@google/generative-ai](https://github.com/google-gemini/generative-ai-js)
- [@octokit/rest](https://github.com/octokit/rest.js) for GitHub API
- [Zod](https://zod.dev) for API input validation
