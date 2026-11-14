# DayFlow — Daily Task Manager

A clean, calendar-first personal planner built with React, Vite, Tailwind CSS and Firebase.

## Features
- Month, week and day calendar views with date navigation.
- Quick-add and edit tasks with notes, date, time, priority and category.
- Daily completion progress, upcoming tasks and task search.
- Category filtering, completion toggles and responsive layout.
- Firebase email/password authentication and Firestore sync.
- Local browser storage demo mode until Firebase is configured.

## Local development
```bash
npm install
cp .env.example .env.local
npm run dev
```

## Firebase setup
1. Create a Firebase project and register a Web app.
2. Enable Authentication → Email/Password.
3. Create a Cloud Firestore database.
4. Copy the Firebase web app configuration into `.env.local` using the `VITE_FIREBASE_*` variable names in `.env.example`.
5. Publish the Firestore rules from `firestore.rules`.

When Firebase variables are absent, the app stores tasks in this browser's local storage. To sync between devices, configure Firebase and sign in. Never commit `.env.local`, service-account keys or private credentials.

## Vercel deployment
Import this repository into Vercel. Add the six `VITE_FIREBASE_*` values in Project Settings → Environment Variables for Production, Preview and Development. Vercel will build with `npm run build` and publish the `dist` directory.

## Firestore data model
Tasks are stored under `users/{uid}/tasks/{taskId}`. Each task contains title, notes, date (YYYY-MM-DD), startTime, endTime, priority, category, completed and createdAt.

## Security
Firestore rules restrict task reads and writes to the authenticated owner. The Firebase web configuration is intended for browser use; access control is enforced by Firebase Authentication and Firestore Rules.
