# DayFlow — Daily Task Manager

A clean, calendar-first personal planner built with Next.js, Tailwind CSS and Firebase.

## Features
- Month, week and day calendar views with date navigation.
- Quick-add tasks with title, notes, date, time, priority and category.
- Today list with completion toggles, progress and upcoming tasks.
- Search and filter by category, priority and completion.
- Responsive layout with a collapsible navigation rail.
- Firebase Authentication and Firestore integration, with local demo mode until Firebase is configured.

## Local development
```bash
npm install
cp .env.example .env.local
npm run dev
```

## Firebase setup
1. Create a Firebase project and register a Web app.
2. Enable Authentication → Email/Password (and optionally Google).
3. Create a Cloud Firestore database.
4. Copy the Firebase web app configuration into `.env.local` using the variable names in `.env.example`.
5. Publish the Firestore rules from `firestore.rules`.

The app runs in demo/local-storage mode when Firebase variables are absent. Do not commit `.env.local` or service-account keys.

## Deploy
Import this repository into Vercel and add the same `NEXT_PUBLIC_FIREBASE_*` variables in Project Settings → Environment Variables. Every push to `main` will trigger a deployment once the Git project is connected.

## Data model
Tasks are stored under `users/{uid}/tasks/{taskId}`. Each task contains title, notes, date (YYYY-MM-DD), startTime, endTime, priority, category, completed, createdAt and updatedAt.

## Security
Firestore rules restrict task reads and writes to the authenticated owner. The Firebase web configuration is intended for browser use; security is enforced by Authentication and Firestore Rules.
