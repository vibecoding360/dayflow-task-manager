# DayFlow — Hybrid Productivity SaaS

DayFlow is a calendar-first productivity app designed to grow from a personal planner into a multi-workspace SaaS for individuals, students, professionals and teams.

## Current product
- Month, week and day calendar views.
- Create, edit, complete and delete tasks.
- Task notes, dates, times, categories and priorities.
- Daily progress, upcoming tasks, category filters and task search.
- Firebase Authentication and real-time Firestore task sync.
- Responsive desktop and mobile layout.

## SaaS direction
DayFlow follows a hybrid SaaS path:
1. Individual users start with a personal workspace and a Free plan.
2. Pro capabilities can be added without changing the personal workspace identity.
3. Team workspaces can later add members, roles, shared projects and shared tasks.
4. Billing and entitlement records are server-managed, never trusted from browser state.

## Architecture
- Frontend: React 19 + Vite.
- UI: custom responsive CSS + Lucide icons.
- Authentication: Firebase Authentication.
- Database: Cloud Firestore.
- Hosting: Vercel.
- Source control: GitHub.

### Firestore collections
```text
users/{uid}
  email
  displayName
  defaultWorkspaceId
  createdAt
  updatedAt
  tasks/{taskId}             # Existing personal tasks; retained for compatibility

workspaces/{workspaceId}
  name
  ownerId
  type                        # personal | team
  plan                        # free | pro | business
  status
  members/{uid}
    userId
    role                      # owner | admin | member
    status
  tasks/{taskId}              # Workspace-shared tasks (future module)
  projects/{projectId}        # Future module
  goals/{goalId}              # Future module

subscriptions/{subscriptionId} # Server-managed billing records
```

## Existing data safety
The first SaaS foundation release provisions a deterministic personal workspace using the user's UID. Existing tasks remain in `users/{uid}/tasks`; no task migration or deletion is performed. Moving existing tasks into workspace collections must be a separately tested migration with a backup and verification step.

## Firebase setup
1. Register a Firebase Web App.
2. Enable Email/Password Authentication.
3. Create Cloud Firestore.
4. Configure the six `VITE_FIREBASE_*` environment variables in local `.env.local` and Vercel.
5. Publish `firestore.rules` from this repository.

Never commit `.env.local`, service-account keys, private keys or other server credentials.

## Local development
```bash
npm install
cp .env.example .env.local
npm run dev
```

## Vercel deployment
Vercel builds with `npm run build` and publishes `dist`. Set the Firebase environment variables for Production, Preview and Development. Git integration should deploy commits from the connected repository.

## Security principles
- A user can access only their own profile and legacy personal tasks.
- Workspace access requires an explicit membership document.
- Workspace creation is owner-bound.
- Only workspace owners can manage workspace metadata and membership.
- Subscription documents are not writable by clients.
- Production billing, invitations, role changes and privileged operations must be implemented in trusted server-side functions with validation and rate limiting.

## Product roadmap
- Foundation: personal workspace provisioning and tenant-aware Firestore rules.
- Next: onboarding, workspace switcher and profile/settings screens.
- Then: recurring tasks, goals, projects and productivity analytics.
- Later: team invitations, role-based collaboration, billing and admin console.
