import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight,
  Clock3, Cloud, CloudOff, Command, Flag, Layers, ListTodo, LogIn, LogOut,
  Timer, Play, Pause, RotateCcw, Menu, MoreHorizontal, Pencil, Plus,
  Search, Settings2, ShieldCheck, Sparkles, Trash2, X, Zap
} from "lucide-react";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, updateProfile, GoogleAuthProvider, signInWithPopup
} from "firebase/auth";
import { auth, db, firebaseReady, ensurePersonalWorkspace } from "./firebase";

const CATEGORIES = ["Study", "Work", "Personal", "Health"];
const PRIORITIES = ["Low", "Medium", "High"];
const COLORS = { Study: "violet", Work: "blue", Personal: "amber", Health: "green" };
const today = new Date();
const dateKey = (d) => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
const fromKey = (s) => { const p = s.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a, b) => dateKey(a) === dateKey(b);
const monthLabel = (d) => d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
const fullDay = (d) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const shortDay = (d) => d.toLocaleDateString("en-US", { weekday: "short" });
const greeting = () => new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";
const makeId = () => globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random());

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');

  :root {
    --bg: #f6f7fb;
    --surface: #ffffff;
    --surface-subtle: #f1f3f9;
    --text: #0f172a;
    --text-muted: #64748b;
    --line: #e2e8f0;
    --accent: #6366f1;
    --accent-hover: #4f46e5;
    --accent-soft: rgba(99, 102, 241, 0.12);
    --shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.05);
    --shadow-md: 0 10px 25px -5px rgba(15, 23, 42, 0.08);
    --shadow-lg: 0 20px 40px -10px rgba(15, 23, 42, 0.16);
    --radius-lg: 18px;
    --radius-md: 12px;
    --radius-sm: 8px;
  }

  .theme-dark {
    --bg: #0b0f19;
    --surface: #131929;
    --surface-subtle: #1b2338;
    --text: #f8fafc;
    --text-muted: #94a3b8;
    --line: #232d45;
    --accent: #818cf8;
    --accent-hover: #6366f1;
    --accent-soft: rgba(129, 140, 248, 0.16);
    --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
    --shadow-md: 0 10px 25px -5px rgba(0, 0, 0, 0.45);
    --shadow-lg: 0 20px 40px -10px rgba(0, 0, 0, 0.65);
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg);
    color: var(--text);
    -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3, .brand { font-family: 'Plus Jakarta Sans', sans-serif; letter-spacing: -0.02em; }

  /* Tones */
  .tone-violet { --tone: #8b5cf6; --tone-bg: rgba(139, 92, 246, 0.14); }
  .tone-blue   { --tone: #0ea5e9; --tone-bg: rgba(14, 165, 233, 0.14); }
  .tone-amber  { --tone: #f59e0b; --tone-bg: rgba(245, 158, 11, 0.15); }
  .tone-green  { --tone: #10b981; --tone-bg: rgba(16, 185, 129, 0.14); }
  .violet { background: #8b5cf6; }
  .blue   { background: #0ea5e9; }
  .amber  { background: #f59e0b; }
  .green  { background: #10b981; }

  /* Buttons & Inputs */
  .icon-button {
    width: 34px; height: 34px; border-radius: var(--radius-sm);
    border: 1px solid var(--line); background: var(--surface);
    color: var(--text-muted); display: inline-grid; place-items: center;
    cursor: pointer; transition: all 0.15s ease;
  }
  .icon-button:hover { color: var(--text); background: var(--surface-subtle); }

  .btn-primary {
    height: 38px; padding: 0 16px; border-radius: var(--radius-sm);
    border: none; background: var(--accent); color: #fff;
    font-weight: 600; font-size: 0.88rem; display: inline-flex;
    align-items: center; justify-content: center; gap: 6px;
    cursor: pointer; transition: all 0.15s ease;
  }
  .btn-primary:hover:not(:disabled) { background: var(--accent-hover); transform: translateY(-1px); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-quiet {
    height: 38px; padding: 0 14px; border-radius: var(--radius-sm);
    border: 1px solid var(--line); background: transparent;
    color: var(--text-muted); font-weight: 500; font-size: 0.88rem;
    cursor: pointer;
  }
  .btn-quiet:hover { background: var(--surface-subtle); color: var(--text); }

  .field-label { display: block; font-size: 0.78rem; font-weight: 600; color: var(--text-muted); margin: 12px 0 5px; }
  .field-input {
    width: 100%; padding: 8px 12px; border-radius: var(--radius-sm);
    border: 1px solid var(--line); background: var(--surface-subtle);
    color: var(--text); font-family: inherit; font-size: 0.9rem;
    outline: none; transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .field-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); background: var(--surface); }

  /* App Shell */
  .app-shell { display: flex; min-height: 100vh; background: var(--bg); color: var(--text); }
  .sidebar {
    width: 248px; flex-shrink: 0; background: var(--surface);
    border-right: 1px solid var(--line); padding: 20px 14px;
    display: flex; flex-direction: column; z-index: 30;
  }
  .brand { display: flex; align-items: center; gap: 10px; font-size: 1.3rem; font-weight: 800; padding: 4px 8px 20px; }
  .brand-icon {
    width: 32px; height: 32px; border-radius: 10px;
    background: linear-gradient(135deg, #6366f1, #a855f7);
    color: #fff; display: grid; place-items: center;
  }
  .brand-period { color: var(--accent); }

  .main-nav { display: flex; flex-direction: column; gap: 4px; }
  .nav-item {
    display: flex; align-items: center; gap: 10px; padding: 10px 12px;
    border-radius: var(--radius-sm); border: none; background: transparent;
    color: var(--text-muted); font-weight: 500; font-size: 0.9rem;
    cursor: pointer; text-align: left; transition: all 0.15s ease;
  }
  .nav-item:hover { background: var(--surface-subtle); color: var(--text); }
  .nav-active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
  .nav-count {
    margin-left: auto; font-size: 0.75rem; font-weight: 700;
    padding: 2px 7px; border-radius: 99px; background: var(--surface-subtle); color: var(--text-muted);
  }
  .nav-active .nav-count { background: var(--accent); color: #fff; }

  .sidebar-divider { height: 1px; background: var(--line); margin: 16px 8px; }
  .category-heading {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em;
    color: var(--text-muted); padding: 0 10px 8px;
  }
  .category-heading button { border: none; background: transparent; color: var(--text-muted); cursor: pointer; display: grid; place-items: center; }
  .category-nav { display: flex; flex-direction: column; gap: 3px; }
  .category-nav-item {
    display: flex; align-items: center; gap: 10px; padding: 8px 12px;
    border-radius: var(--radius-sm); border: none; background: transparent;
    color: var(--text-muted); font-size: 0.88rem; font-weight: 500; cursor: pointer;
  }
  .category-nav-item:hover { background: var(--surface-subtle); color: var(--text); }
  .category-nav-selected { background: var(--surface-subtle); color: var(--text); font-weight: 600; }
  .category-dot { width: 9px; height: 9px; border-radius: 50%; }
  .category-total { margin-left: auto; font-size: 0.76rem; color: var(--text-muted); }

  .sidebar-bottom { margin-top: auto; padding-top: 14px; border-top: 1px solid var(--line); }
  .profile-row { display: flex; align-items: center; gap: 10px; padding: 6px; border-radius: var(--radius-md); }
  .avatar, .top-avatar {
    width: 34px; height: 34px; border-radius: 10px; background: var(--accent-soft);
    color: var(--accent); font-weight: 700; display: grid; place-items: center; overflow: hidden; flex-shrink: 0;
  }
  .avatar img, .top-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .profile-copy { display: flex; flex-direction: column; min-width: 0; }
  .profile-copy strong { font-size: 0.86rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .profile-copy span { font-size: 0.74rem; color: var(--text-muted); }
  .profile-action { margin-left: auto; border: none; background: transparent; color: var(--text-muted); cursor: pointer; padding: 6px; border-radius: 8px; }
  .profile-action:hover { background: var(--surface-subtle); color: var(--text); }

  /* Main Area & Topbar */
  .main-area { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .topbar {
    height: 60px; padding: 0 24px; background: var(--surface);
    border-bottom: 1px solid var(--line); display: flex;
    align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 20;
  }
  .topbar-left, .topbar-right { display: flex; align-items: center; gap: 12px; }
  .menu-toggle { display: none; }
  .breadcrumb { font-size: 0.86rem; color: var(--text-muted); }
  .breadcrumb b { color: var(--text); }
  .kbd-hint {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 5px 10px; border-radius: 8px; border: 1px solid var(--line);
    background: var(--surface-subtle); color: var(--text-muted);
    font-size: 0.78rem; font-weight: 600; cursor: pointer;
  }
  .kbd-hint:hover { border-color: var(--accent); color: var(--accent); }
  .sync-status {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 0.78rem; font-weight: 600; padding: 5px 10px;
    border-radius: 99px; background: var(--surface-subtle); color: var(--text-muted);
  }
  .sync-status.synced { color: #10b981; background: rgba(16, 185, 129, 0.12); }
  .top-signin {
    height: 32px; padding: 0 11px; border-radius: 8px;
    border: 1px solid var(--line); background: var(--surface);
    color: var(--text); font-size: 0.8rem; font-weight: 600;
    display: inline-flex; align-items: center; gap: 5px; cursor: pointer;
  }
  .top-avatar-button { border: none; cursor: pointer; }

  .page-content { max-width: 1360px; width: 100%; margin: 0 auto; padding: 24px; }
  .welcome-row { display: flex; justify-content: space-between; }
  .date-overline { font-size: 0.84rem; color: var(--text-muted); }

  /* Stats Grid */
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 22px; }
  .stat-card {
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-lg); padding: 18px 20px; box-shadow: var(--shadow-sm);
  }
  .stat-highlight {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: #fff; border: none;
  }
  .stat-top { display: flex; justify-content: space-between; align-items: center; font-size: 0.84rem; font-weight: 600; opacity: 0.9; margin-bottom: 10px; }
  .stat-icon { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; background: rgba(255,255,255,0.2); }
  .pale-blue { background: rgba(14, 165, 233, 0.14); color: #0ea5e9; }
  .pale-green { background: rgba(16, 185, 129, 0.14); color: #10b981; }
  .pale-amber { background: rgba(245, 158, 11, 0.14); color: #f59e0b; }
  .stat-number { font-size: 1.85rem; font-weight: 800; font-family: 'Plus Jakarta Sans', sans-serif; }
  .stat-main { display: flex; align-items: center; justify-content: space-between; }
  .stat-main strong { font-size: 2rem; font-weight: 800; font-family: 'Plus Jakarta Sans', sans-serif; }
  .stat-main strong small { font-size: 1rem; font-weight: 600; }
  .progress-ring {
    width: 48px; height: 48px; border-radius: 50%;
    background: conic-gradient(#fff var(--progress), rgba(255,255,255,0.24) 0deg);
    display: grid; place-items: center;
  }
  .progress-ring div {
    width: 38px; height: 38px; border-radius: 50%; background: #7363f3;
    display: grid; place-items: center; font-size: 0.72rem; font-weight: 700;
  }

  /* Planner Layout */
  .planner-layout { display: grid; grid-template-columns: 1fr 330px; gap: 20px; align-items: start; }
  .calendar-card, .agenda-card {
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-lg); padding: 20px; box-shadow: var(--shadow-sm);
  }
  .calendar-toolbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
  .calendar-toolbar h2 { margin: 0; font-size: 1.2rem; }
  .calendar-actions { display: flex; align-items: center; gap: 8px; }
  .today-button {
    height: 32px; padding: 0 12px; border-radius: var(--radius-sm);
    border: 1px solid var(--line); background: var(--surface); color: var(--text);
    font-size: 0.82rem; font-weight: 600; cursor: pointer;
  }
  .view-switch { display: flex; background: var(--surface-subtle); padding: 3px; border-radius: var(--radius-sm); }
  .view-switch button {
    border: none; background: transparent; color: var(--text-muted);
    padding: 5px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer;
  }
  .view-switch .view-selected { background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm); }
  .month-arrows { display: flex; gap: 4px; }

  .calendar-legend { display: flex; gap: 16px; font-size: 0.78rem; color: var(--text-muted); margin-bottom: 14px; }
  .calendar-legend span { display: inline-flex; align-items: center; gap: 6px; }
  .legend-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }

  /* Month Grid */
  .weekday-row { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); padding-bottom: 8px; }
  .month-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
  .month-cell {
    min-height: 92px; padding: 7px; border-radius: var(--radius-md);
    border: 1px solid var(--line); background: var(--surface);
    color: var(--text); display: flex; flex-direction: column; align-items: stretch;
    text-align: left; cursor: pointer; transition: all 0.14s ease; overflow: hidden;
  }
  .month-cell:hover { border-color: var(--accent); }
  .outside-month { opacity: 0.42; background: var(--surface-subtle); }
  .selected-cell { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
  .current-cell .cell-date {
    background: var(--accent); color: #fff; width: 23px; height: 23px;
    border-radius: 50%; display: inline-grid; place-items: center;
  }
  .drop-target { background: var(--accent-soft) !important; border-style: dashed; }
  .cell-date { font-size: 0.8rem; font-weight: 700; margin-bottom: 5px; }
  .cell-events { display: flex; flex-direction: column; gap: 3px; }
  .more-events { font-size: 0.7rem; font-weight: 600; color: var(--text-muted); padding-left: 4px; }

  /* Task Pill */
  .task-pill {
    flex: 1; min-width: 0; border: none; border-radius: 6px;
    background: var(--tone-bg); color: var(--text);
    padding: 3px 6px; font-size: 0.74rem; font-weight: 600;
    display: flex; align-items: center; gap: 5px; cursor: pointer; text-align: left;
  }
  .task-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--tone); flex-shrink: 0; }
  .task-pill-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .task-pill-time { margin-left: auto; font-size: 0.68rem; color: var(--text-muted); }
  .task-pill.is-done .task-pill-title { text-decoration: line-through; opacity: 0.55; }

  /* Week & Day Views */
  .week-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
  .week-column { border: 1px solid var(--line); border-radius: var(--radius-md); padding: 8px; min-height: 300px; background: var(--surface-subtle); }
  .week-today { border-color: var(--accent); background: var(--surface); }
  .week-day-head { width: 100%; border: none; background: transparent; color: var(--text); display: flex; flex-direction: column; align-items: center; padding-bottom: 8px; border-bottom: 1px solid var(--line); margin-bottom: 8px; cursor: pointer; }
  .week-day-head span { font-size: 0.72rem; color: var(--text-muted); }
  .week-day-head b { font-size: 1rem; margin-top: 2px; }
  .week-events { display: flex; flex-direction: column; gap: 6px; }
  .week-add { border: 1px dashed var(--line); background: transparent; color: var(--text-muted); border-radius: 6px; padding: 5px; cursor: pointer; display: grid; place-items: center; }

  .day-agenda { display: flex; flex-direction: column; gap: 10px; min-height: 260px; }
  .day-event { display: flex; gap: 14px; align-items: stretch; }
  .day-event-time { width: 68px; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); display: flex; flex-direction: column; justify-content: center; }
  .day-event-time span { font-size: 0.72rem; font-weight: 500; }
  .day-event-bar { flex: 1; background: var(--tone-bg); border-left: 4px solid var(--tone); border-radius: 10px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; }
  .day-event-bar strong { display: block; font-size: 0.94rem; }
  .day-event-bar span { font-size: 0.78rem; color: var(--text-muted); }
  .day-event-actions { display: flex; gap: 8px; }
  .day-event-actions button { border: none; background: transparent; color: var(--text); cursor: pointer; display: grid; place-items: center; }
  .empty-check { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--text-muted); display: inline-block; }
  .strike { text-decoration: line-through; opacity: 0.6; }

  .calendar-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--line); font-size: 0.82rem; color: var(--text-muted); }
  .footer-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); display: inline-block; margin-right: 6px; }
  .calendar-footer button { border: none; background: transparent; color: var(--accent); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }

  /* Agenda Sidebar */
  .agenda-heading { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .agenda-heading h2 { margin: 0; font-size: 1.1rem; }
  .more-button { border: none; background: transparent; color: var(--text-muted); cursor: pointer; }
  .agenda-date { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--surface-subtle); border-radius: var(--radius-md); margin-bottom: 14px; }
  .agenda-date-number { width: 42px; height: 42px; border-radius: 12px; background: var(--accent); color: #fff; font-size: 1.25rem; font-weight: 800; display: grid; place-items: center; }
  .agenda-date strong { display: block; font-size: 0.95rem; }
  .agenda-date span { font-size: 0.8rem; color: var(--text-muted); }

  .agenda-progress { margin-bottom: 14px; }
  .agenda-progress div:first-child { display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 6px; }
  .progress-track { height: 6px; border-radius: 99px; background: var(--surface-subtle); overflow: hidden; }
  .progress-track span { display: block; height: 100%; background: var(--accent); border-radius: 99px; transition: width 0.25s ease; }

  .agenda-search { display: flex; align-items: center; gap: 8px; padding: 7px 11px; border-radius: var(--radius-sm); border: 1px solid var(--line); background: var(--surface-subtle); margin-bottom: 12px; color: var(--text-muted); }
  .agenda-search input { border: none; background: transparent; color: var(--text); width: 100%; outline: none; font-size: 0.85rem; }

  .agenda-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
  .agenda-task { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: var(--radius-sm); border: 1px solid var(--line); background: var(--surface); }
  .task-check { width: 19px; height: 19px; border-radius: 6px; border: 1.5px solid var(--line); background: transparent; color: #fff; display: grid; place-items: center; cursor: pointer; flex-shrink: 0; }
  .agenda-task-done .task-check { background: var(--accent); border-color: var(--accent); }
  .agenda-task-done strong { text-decoration: line-through; opacity: 0.55; }
  .agenda-task-main { flex: 1; border: none; background: transparent; color: var(--text); text-align: left; cursor: pointer; min-width: 0; }
  .agenda-task-main strong { display: block; font-size: 0.88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .agenda-task-main span { display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem; color: var(--text-muted); }
  .priority-high { color: #ef4444; }
  .priority-medium { color: #f59e0b; }
  .priority-low { color: #10b981; }

  .agenda-empty, .day-empty { text-align: center; padding: 24px 12px; color: var(--text-muted); }
  .empty-illustration { width: 44px; height: 44px; border-radius: 14px; background: var(--accent-soft); color: var(--accent); display: inline-grid; place-items: center; margin-bottom: 8px; }
  .agenda-empty button { margin-top: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--text); padding: 6px 12px; border-radius: 8px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }

  .agenda-add { width: 100%; height: 38px; border-radius: var(--radius-sm); border: 1px dashed var(--accent); background: var(--accent-soft); color: var(--accent); font-weight: 600; font-size: 0.86rem; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; margin-bottom: 18px; }

  .upcoming-block { border-top: 1px solid var(--line); padding-top: 14px; }
  .upcoming-title { display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; font-weight: 700; color: var(--text-muted); margin-bottom: 10px; }
  .upcoming-title button { border: none; background: transparent; color: var(--accent); font-weight: 600; display: inline-flex; align-items: center; gap: 3px; cursor: pointer; }
  .upcoming-item { width: 100%; display: flex; align-items: center; gap: 10px; padding: 8px; border: none; background: transparent; color: var(--text); border-radius: 8px; cursor: pointer; text-align: left; }
  .upcoming-item:hover { background: var(--surface-subtle); }
  .upcoming-marker { width: 4px; height: 26px; border-radius: 99px; }
  .upcoming-copy { flex: 1; min-width: 0; }
  .upcoming-copy strong { display: block; font-size: 0.84rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .upcoming-copy small { font-size: 0.74rem; color: var(--text-muted); }
  .no-upcoming { font-size: 0.82rem; color: var(--text-muted); margin: 0; }

  /* Focus Timer */
  .study-heading { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
  .study-heading h1 { margin: 0; font-size: 1.5rem; }
  .study-live { display: inline-flex; align-items: center; gap: 6px; font-size: 0.72rem; font-weight: 800; padding: 4px 10px; border-radius: 99px; background: rgba(239, 68, 68, 0.12); color: #ef4444; }
  .study-live i { width: 7px; height: 7px; border-radius: 50%; background: #ef4444; display: inline-block; }
  .study-layout { display: grid; grid-template-columns: 1fr 340px; gap: 20px; }
  .study-timer-card {
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg);
    padding: 36px 24px; text-align: center; box-shadow: var(--shadow-sm);
    display: flex; flex-direction: column; align-items: center;
  }
  .study-session-label { display: inline-flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.08em; color: var(--accent); margin-bottom: 10px; }
  .study-session-name { border: none; background: transparent; color: var(--text); font-size: 1.15rem; font-weight: 600; text-align: center; outline: none; border-bottom: 1px dashed var(--line); padding-bottom: 4px; margin-bottom: 24px; }
  .study-clock { font-family: 'Plus Jakarta Sans', monospace; font-size: 4.2rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1; margin: 8px 0; }
  .study-clock-caption { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 24px; }
  .study-controls { display: flex; gap: 10px; margin-bottom: 24px; }
  .study-start { height: 44px; padding: 0 24px; font-size: 0.95rem; }
  .study-reset { width: 44px; height: 44px; border-radius: var(--radius-sm); border: 1px solid var(--line); background: var(--surface-subtle); color: var(--text); display: grid; place-items: center; cursor: pointer; }
  .duration-fields { display: inline-flex; align-items: center; gap: 8px; background: var(--surface-subtle); padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); }
  .duration-fields input { width: 48px; border: none; background: transparent; color: var(--text); font-weight: 700; font-size: 1rem; text-align: center; }
  .duration-fields small { font-size: 0.75rem; color: var(--text-muted); }
  .duration-fields button { border: none; background: var(--accent); color: #fff; padding: 6px 12px; border-radius: 7px; font-weight: 600; font-size: 0.8rem; cursor: pointer; }

  .study-side { display: flex; flex-direction: column; gap: 16px; }
  .study-insight { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .study-metric { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 14px 10px; text-align: center; }
  .study-metric strong { display: block; font-size: 1.15rem; font-weight: 800; }
  .study-metric span { font-size: 0.72rem; color: var(--text-muted); }
  .weekly-report { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 18px; }
  .weekly-report-score { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
  .weekly-report-score strong { font-size: 1.5rem; font-weight: 800; }
  .weekly-report-track { height: 8px; background: var(--surface-subtle); border-radius: 99px; overflow: hidden; margin-bottom: 12px; }
  .weekly-report-track i { display: block; height: 100%; background: var(--accent); border-radius: 99px; }
  .weekly-report-stats { display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px; }
  .weekly-report-categories { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; font-size: 0.78rem; }
  .weekly-report-categories span { display: flex; justify-content: space-between; padding: 6px 10px; background: var(--surface-subtle); border-radius: 8px; }
  .study-templates div { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .study-templates button { padding: 9px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--text); font-weight: 600; font-size: 0.82rem; cursor: pointer; }
  .study-templates button:hover { border-color: var(--accent); color: var(--accent); }
  .study-add-task { width: 100%; padding: 12px; border-radius: 12px; border: 1px dashed var(--line); background: var(--surface); color: var(--text); font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }

  /* Modals */
  .modal-backdrop {
    position: fixed; inset: 0;
    background: rgba(15, 23, 42, 0.52);
    backdrop-filter: blur(6px);
    display: grid; place-items: center;
    padding: 16px; z-index: 100;
  }
  .task-modal, .auth-modal, .onboarding-modal, .settings-modal, .cmd-modal {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    padding: 24px;
    width: 100%;
    max-width: 460px;
    box-shadow: var(--shadow-lg);
    position: relative;
  }
  .modal-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .modal-top h2 { margin: 0; font-size: 1.2rem; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .category-options { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 6px; }
  .category-choice {
    border: 1px solid var(--line); border-radius: 8px; padding: 8px 6px;
    font-size: 0.78rem; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 5px; cursor: pointer; opacity: 0.75;
  }
  .category-choice.selected { opacity: 1; outline: 2px solid var(--accent); }
  .modal-actions { display: flex; align-items: center; gap: 8px; margin-top: 20px; }
  .actions-spacer { flex: 1; }
  .delete-button { border: none; background: rgba(239, 68, 68, 0.12); color: #ef4444; padding: 8px 12px; border-radius: 8px; font-weight: 600; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
  .form-error { color: #ef4444; font-size: 0.82rem; margin-top: 10px; }

  .auth-modal { max-width: 390px; }
  .auth-mark { width: 42px; height: 42px; border-radius: 12px; background: var(--accent-soft); color: var(--accent); display: grid; place-items: center; margin-bottom: 12px; }
  .auth-close { position: absolute; top: 20px; right: 20px; }
  .auth-submit { width: 100%; margin-top: 18px; height: 42px; }
  .auth-switch { text-align: center; font-size: 0.84rem; color: var(--text-muted); margin-top: 14px; }
  .auth-switch button { border: none; background: transparent; color: var(--accent); font-weight: 600; cursor: pointer; }

  .settings-section { padding: 12px 0; border-top: 1px solid var(--line); }
  .settings-section h3 { margin: 0 0 6px; font-size: 0.9rem; }
  .settings-choice-row, .settings-toggle { display: flex; justify-content: space-between; align-items: center; font-size: 0.88rem; }
  .settings-select { width: 130px; }
  .settings-permission { margin-top: 8px; border: 1px solid var(--line); background: var(--surface-subtle); color: var(--text); padding: 6px 12px; border-radius: 8px; font-size: 0.8rem; cursor: pointer; }

  /* Command Palette */
  .cmd-modal { max-width: 520px; padding: 0; overflow: hidden; }
  .cmd-head { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--line); color: var(--text-muted); }
  .cmd-head input { flex: 1; border: none; background: transparent; color: var(--text); font-size: 0.98rem; outline: none; }
  .cmd-list { padding: 8px; display: flex; flex-direction: column; gap: 4px; }
  .cmd-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border: none; background: transparent; color: var(--text); border-radius: 10px; cursor: pointer; font-size: 0.88rem; text-align: left; }
  .cmd-item:hover { background: var(--accent-soft); color: var(--accent); }
  .cmd-item span { display: inline-flex; align-items: center; gap: 10px; font-weight: 500; }
  .cmd-item kbd { font-size: 0.72rem; padding: 2px 6px; border-radius: 5px; background: var(--surface-subtle); border: 1px solid var(--line); color: var(--text-muted); }

  /* Toast */
  .toast {
    position: fixed; bottom: 24px; right: 24px;
    background: #0f172a; color: #fff;
    padding: 10px 16px; border-radius: 12px;
    font-size: 0.85rem; font-weight: 600;
    display: inline-flex; align-items: center; gap: 8px;
    box-shadow: var(--shadow-lg); z-index: 200;
    animation: slideUp 0.2s ease;
  }
  @keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

  /* Marketing Landing Page */
  .marketing-shell {
    min-height: 100vh;
    background:
      radial-gradient(circle at 15% 10%, rgba(99, 102, 241, 0.14), transparent 38%),
      radial-gradient(circle at 85% 20%, rgba(168, 85, 247, 0.12), transparent 36%),
      #f8f9fc;
    color: #0f172a;
  }
  .marketing-nav {
    max-width: 1160px; margin: 0 auto; padding: 20px 24px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .marketing-brand { display: inline-flex; align-items: center; gap: 10px; font-size: 1.35rem; font-weight: 800; color: #0f172a; text-decoration: none; }
  .marketing-brand span { color: #6366f1; }
  .marketing-brand-icon { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, #6366f1, #a855f7); color: #fff; display: grid; place-items: center; }
  .marketing-links { display: flex; gap: 28px; }
  .marketing-links a { text-decoration: none; color: #475569; font-weight: 500; font-size: 0.92rem; }
  .marketing-links a:hover { color: #0f172a; }
  .marketing-nav-actions { display: flex; align-items: center; gap: 10px; }
  .marketing-google-login, .marketing-login {
    height: 38px; padding: 0 14px; border-radius: 10px; border: 1px solid #e2e8f0;
    background: #fff; color: #0f172a; font-weight: 600; font-size: 0.86rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  }
  .marketing-nav-cta {
    height: 38px; padding: 0 16px; border-radius: 10px; border: none;
    background: #0f172a; color: #fff; font-weight: 600; font-size: 0.86rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
  }
  .marketing-menu-toggle { display: none; border: none; background: transparent; }

  .marketing-hero {
    max-width: 1160px; margin: 0 auto; padding: 56px 24px 72px;
    display: grid; grid-template-columns: 1fr 1.15fr; gap: 48px; align-items: center;
  }
  .hero-badge {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 6px 12px; border-radius: 99px;
    background: rgba(99, 102, 241, 0.1); color: #4f46e5;
    font-size: 0.8rem; font-weight: 700; margin-bottom: 18px;
  }
  .hero-copy h1 { font-size: 3.6rem; line-height: 1.06; letter-spacing: -0.04em; margin: 0 0 18px; }
  .hero-copy h1 span { background: linear-gradient(135deg, #6366f1, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .hero-description { font-size: 1.12rem; line-height: 1.6; color: #475569; margin: 0 0 28px; max-width: 460px; }
  .hero-actions { display: flex; gap: 12px; }
  .hero-primary {
    height: 48px; padding: 0 24px; border-radius: 12px; border: none;
    background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff;
    font-weight: 600; font-size: 0.98rem; display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
    box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.45);
  }
  .hero-secondary {
    height: 48px; padding: 0 22px; border-radius: 12px; border: 1px solid #cbd5e1;
    background: #fff; color: #0f172a; font-weight: 600; font-size: 0.98rem; cursor: pointer;
  }

  .hero-visual { position: relative; }
  .preview-window {
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(226, 232, 240, 0.9);
    border-radius: 20px;
    box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.14);
    overflow: hidden;
  }
  .preview-top { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 0.72rem; font-weight: 700; color: #94a3b8; }
  .preview-dots { display: flex; gap: 6px; }
  .preview-dots i { width: 9px; height: 9px; border-radius: 50%; background: #e2e8f0; display: inline-block; }
  .preview-user { width: 22px; height: 22px; border-radius: 6px; background: #6366f1; color: #fff; display: grid; place-items: center; }
  .preview-content { display: grid; grid-template-columns: 140px 1fr; min-height: 270px; }
  .preview-sidebar { border-right: 1px solid #f1f5f9; padding: 14px; display: flex; flex-direction: column; gap: 8px; font-size: 0.8rem; color: #64748b; }
  .preview-logo { font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
  .preview-nav-active { background: rgba(99, 102, 241, 0.1); color: #6366f1; font-weight: 600; padding: 7px 10px; border-radius: 8px; display: flex; align-items: center; gap: 7px; }
  .preview-sidebar > div:not(.preview-logo):not(.preview-nav-active) { padding: 7px 10px; display: flex; align-items: center; gap: 7px; }
  .preview-main { padding: 18px; }
  .preview-month { display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 0.9rem; }
  .preview-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; text-align: center; margin-bottom: 16px; }
  .preview-days div { padding: 8px 4px; border-radius: 10px; background: #f8fafc; }
  .preview-days small { display: block; font-size: 0.68rem; color: #94a3b8; }
  .preview-days b { display: inline-grid; place-items: center; width: 24px; height: 24px; font-size: 0.82rem; margin-top: 4px; border-radius: 50%; }
  .preview-today { background: #6366f1; color: #fff; }
  .preview-events { display: flex; flex-direction: column; gap: 8px; }
  .preview-event { padding: 9px 12px; border-radius: 9px; font-size: 0.8rem; font-weight: 600; }
  .event-purple { background: #f3e8ff; color: #7e22ce; }
  .event-blue { background: #e0f2fe; color: #0369a1; }
  .event-orange { background: #fef3c7; color: #b45309; }

  .marketing-section, .how-section, .pricing-section { max-width: 1160px; margin: 0 auto; padding: 56px 24px; }
  .section-intro h2, .how-heading h2, .pricing-section h2 { font-size: 2rem; margin: 0 0 24px; letter-spacing: -0.03em; }
  .feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .feature-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 24px; box-shadow: var(--shadow-sm); }
  .feature-icon { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; margin-bottom: 14px; }
  .feature-lilac { background: #f3e8ff; color: #7e22ce; }
  .feature-blue { background: #e0f2fe; color: #0369a1; }
  .feature-peach { background: #fef3c7; color: #b45309; }
  .feature-card h3 { margin: 0 0 8px; font-size: 1.15rem; }
  .feature-card p { margin: 0; color: #64748b; line-height: 1.55; font-size: 0.94rem; }

  .how-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .how-steps article { background: #fff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 24px; }
  .how-steps b { font-size: 0.85rem; color: #6366f1; font-family: 'Plus Jakarta Sans', sans-serif; }
  .how-steps h3 { margin: 8px 0 6px; }
  .how-steps p { margin: 0; color: #64748b; font-size: 0.92rem; }

  .pricing-card { max-width: 380px; background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 28px; box-shadow: var(--shadow-md); }
  .pricing-price { font-size: 2.4rem; font-weight: 800; font-family: 'Plus Jakarta Sans', sans-serif; margin-bottom: 16px; }
  .pricing-card ul { list-style: none; padding: 0; margin: 0 0 22px; display: flex; flex-direction: column; gap: 10px; color: #475569; font-size: 0.92rem; }
  .pricing-card li { display: flex; align-items: center; gap: 8px; }
  .pricing-card li svg { color: #16a34a; }
  .pricing-card button { width: 100%; height: 42px; border-radius: 10px; border: none; background: #0f172a; color: #fff; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }

  .marketing-footer { max-width: 1160px; margin: 0 auto; padding: 28px 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; color: #64748b; font-size: 0.88rem; }

  @media (max-width: 980px) {
    .planner-layout, .study-layout, .marketing-hero { grid-template-columns: 1fr; }
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .feature-grid, .how-steps { grid-template-columns: 1fr; }
    .sidebar { position: fixed; inset: 0 auto 0 0; transform: translateX(-100%); transition: transform 0.2s ease; }
    .sidebar.sidebar-open { transform: translateX(0); }
    .menu-toggle { display: inline-grid; }
    .mobile-scrim { position: fixed; inset: 0; background: rgba(0,0,0,0.4); border: none; z-index: 25; }
  }
`;

function IconButton({ children, onClick, label, className = "" }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className={"icon-button " + className}>{children}</button>;
}

function TaskPill({ task, onClick, onToggle, compact = false }) {
  const tone = COLORS[task.category] || "violet";
  return (
    <span
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/dayflow-task", task.id)}
      className="task-pill-wrap"
      style={{ display: "flex", alignItems: "center", gap: 3, minWidth: 0 }}
    >
      {onToggle && (
        <button
          type="button"
          aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
          title={task.completed ? "Incomplete" : "Complete"}
          onClick={(e) => { e.stopPropagation(); onToggle(task); }}
          style={{
            width: 17, height: 17, flex: "0 0 17px", borderRadius: 5,
            border: "1px solid var(--line, #d8dce5)",
            background: task.completed ? "var(--accent, #6366f1)" : "transparent",
            color: "#fff", display: "grid", placeItems: "center", padding: 0, cursor: "pointer"
          }}
        >
          {task.completed ? <Check size={11} /> : null}
        </button>
      )}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(task); }}
        className={"task-pill tone-" + tone + (task.completed ? " is-done" : "") + (compact ? " task-pill-compact" : "")}
      >
        <span className="task-dot" />
        <span className="task-pill-title">{task.title}</span>
        {!compact && task.startTime && <span className="task-pill-time">{task.startTime}</span>}
      </button>
    </span>
  );
}

function CommandPalette({ open, onClose, onNewTask, onSwitchView, onToggleTheme }) {
  const [query, setQuery] = useState("");
  if (!open) return null;

  const actions = [
    { label: "Create new task", shortcut: "N", icon: <Plus size={16} />, run: () => { onClose(); onNewTask(); } },
    { label: "Go to Month Calendar", shortcut: "1", icon: <CalendarDays size={16} />, run: () => { onClose(); onSwitchView("month"); } },
    { label: "Go to Week View", shortcut: "2", icon: <Layers size={16} />, run: () => { onClose(); onSwitchView("week"); } },
    { label: "Go to Day Agenda", shortcut: "3", icon: <ListTodo size={16} />, run: () => { onClose(); onSwitchView("day"); } },
    { label: "Open Focus Timer", shortcut: "T", icon: <Timer size={16} />, run: () => { onClose(); onSwitchView("timer"); } },
    { label: "Toggle Dark / Light Mode", shortcut: "D", icon: <Sparkles size={16} />, run: () => { onClose(); onToggleTheme(); } },
  ].filter((a) => a.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cmd-modal">
        <div className="cmd-head">
          <Command size={17} />
          <input
            autoFocus
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
          />
          <IconButton label="Close" onClick={onClose}><X size={16} /></IconButton>
        </div>
        <div className="cmd-list">
          {actions.map((act) => (
            <button key={act.label} className="cmd-item" onClick={act.run}>
              <span>{act.icon} {act.label}</span>
              <kbd>{act.shortcut}</kbd>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TaskModal({ initial, date, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [taskDate, setTaskDate] = useState(initial?.date || dateKey(date));
  const [startTime, setStartTime] = useState(initial?.startTime || "09:00");
  const [endTime, setEndTime] = useState(initial?.endTime || "10:00");
  const [priority, setPriority] = useState(initial?.priority || "Medium");
  const [category, setCategory] = useState(initial?.category || localStorage.getItem("dayflow-last-category") || "Study");
  const [repeat, setRepeat] = useState(initial?.repeat || "none");
  const [reminder, setReminder] = useState(initial?.reminder || "none");
  const [template, setTemplate] = useState("");
  const [error, setError] = useState("");

  function applyTemplate(value) {
    setTemplate(value);
    const presets = {
      "Study session": { title: "Study session", category: "Study", startTime: "09:00", endTime: "10:00", priority: "High" },
      "Revision": { title: "Revise notes", category: "Study", startTime: "18:00", endTime: "19:00", priority: "Medium" },
      "Practice questions": { title: "Practice questions", category: "Study", startTime: "10:00", endTime: "11:00", priority: "High" },
      "Assignment": { title: "Complete assignment", category: "Study", startTime: "16:00", endTime: "17:00", priority: "High" },
      "Work block": { title: "Focused work block", category: "Work", startTime: "09:00", endTime: "10:00", priority: "Medium" }
    };
    const p = presets[value];
    if (p) { setTitle(p.title); setCategory(p.category); setStartTime(p.startTime); setEndTime(p.endTime); setPriority(p.priority); }
  }

  function submit(e) {
    e.preventDefault();
    if (!title.trim()) { setError("Title required."); return; }
    onSave({ title: title.trim(), notes: notes.trim(), date: taskDate, startTime, endTime, priority, category, repeat, reminder });
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="task-modal" onSubmit={submit}>
        <div className="modal-top">
          <h2>{initial ? "Edit task" : "New task"}</h2>
          <IconButton label="Close" onClick={onClose}><X size={19} /></IconButton>
        </div>

        <label className="field-label">Template</label>
        <select className="field-input" value={template} onChange={(e) => applyTemplate(e.target.value)}>
          <option value="">None</option>
          <option>Study session</option>
          <option>Revision</option>
          <option>Practice questions</option>
          <option>Assignment</option>
          <option>Work block</option>
        </select>

        <label className="field-label">Title</label>
        <input autoFocus className="field-input title-input" placeholder="Task title..." value={title} onChange={(e) => setTitle(e.target.value)} />

        <label className="field-label">Notes</label>
        <textarea className="field-input notes-input" placeholder="Notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows="2" />

        <div className="form-grid">
          <div><label className="field-label">Date</label><input className="field-input" type="date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} /></div>
          <div><label className="field-label">Priority</label><select className="field-input" value={priority} onChange={(e) => setPriority(e.target.value)}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></div>
          <div><label className="field-label">Start</label><input className="field-input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
          <div><label className="field-label">End</label><input className="field-input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
        </div>

        <div className="form-grid">
          <div>
            <label className="field-label">Repeat</label>
            <select className="field-input" value={repeat} onChange={(e) => setRepeat(e.target.value)}>
              <option value="none">Never</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label className="field-label">Reminder</label>
            <select className="field-input" value={reminder} onChange={(e) => setReminder(e.target.value)}>
              <option value="none">Off</option>
              <option value="0">At start</option>
              <option value="5">5m before</option>
              <option value="15">15m before</option>
              <option value="30">30m before</option>
              <option value="60">1h before</option>
            </select>
          </div>
        </div>

        <label className="field-label">Category</label>
        <div className="category-options">
          {CATEGORIES.map((item) => (
            <button type="button" key={item} onClick={() => setCategory(item)} className={"category-choice tone-" + COLORS[item] + (category === item ? " selected" : "")}>
              <span className="task-dot" />{item}
            </button>
          ))}
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          {initial && <button type="button" className="delete-button" onClick={() => onDelete(initial.id)}><Trash2 size={16} /> Delete</button>}
          <div className="actions-spacer" />
          <button type="button" className="btn-quiet" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary"><Check size={16} /> {initial ? "Save" : "Add"}</button>
        </div>
      </form>
    </div>
  );
}

function AuthModal({ onClose, onSubmit, busy, error }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="auth-modal" onSubmit={(e) => { e.preventDefault(); onSubmit(email, password, mode, fullName); }}>
        <div className="auth-mark"><Sparkles size={21} /></div>
        <IconButton label="Close" onClick={onClose} className="auth-close"><X size={18} /></IconButton>
        <h2>{mode === "signin" ? "Sign in" : "Sign up"}</h2>
        {mode === "signup" && (
          <>
            <label className="field-label">Name</label>
            <input className="field-input" type="text" required minLength="2" maxLength="60" placeholder="Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </>
        )}
        <label className="field-label">Email</label>
        <input className="field-input" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="field-label">Password</label>
        <input className="field-input" type="password" minLength="6" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="form-error">{error}</p>}
        <button disabled={busy} className="btn-primary auth-submit">
          {busy ? "Wait..." : mode === "signin" ? "Sign in" : "Sign up"} <ArrowRight size={17} />
        </button>
        <p className="auth-switch">
          {mode === "signin" ? "No account?" : "Have an account?"}{" "}
          <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </form>
    </div>
  );
}

function OnboardingModal({ name, workspaceName, setName, setWorkspaceName, onSubmit, busy, error }) {
  return (
    <div className="modal-backdrop onboarding-backdrop">
      <form className="onboarding-modal" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <div className="auth-mark"><Sparkles size={22} /></div>
        <h2>Setup your workspace</h2>
        <label className="field-label">Name</label>
        <input className="field-input" required minLength="2" maxLength="60" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="field-label">Workspace</label>
        <input className="field-input" required minLength="2" maxLength="60" placeholder="Workspace" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} />
        {error && <p className="form-error">{error}</p>}
        <button className="btn-primary auth-submit" disabled={busy}>
          {busy ? "Saving..." : "Continue"} <ArrowRight size={17} />
        </button>
      </form>
    </div>
  );
}

function SettingsModal({ user, workspace, onClose, onSave, onRequestReminderPermission, saving, error, theme, setTheme, notifications, setNotifications }) {
  const [name, setName] = useState(user?.displayName || "");
  const [space, setSpace] = useState(workspace?.name || "Personal workspace");

  return (
    <div className="modal-backdrop settings-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="settings-modal" onSubmit={(e) => { e.preventDefault(); onSave(name, space); }}>
        <div className="modal-top">
          <h2>Settings</h2>
          <IconButton label="Close" onClick={onClose}><X size={19} /></IconButton>
        </div>

        <section className="settings-section">
          <h3>Account</h3>
          <label className="field-label">Name</label>
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} required minLength="2" maxLength="60" />
          <label className="field-label">Email</label>
          <input className="field-input" value={user?.email || ""} disabled />
        </section>

        <section className="settings-section">
          <h3>Workspace</h3>
          <label className="field-label">Name</label>
          <input className="field-input" value={space} onChange={(e) => setSpace(e.target.value)} required minLength="2" maxLength="60" />
        </section>

        <section className="settings-section">
          <h3>Theme</h3>
          <div className="settings-choice-row">
            <b>Mode</b>
            <select className="field-input settings-select" value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>
        </section>

        <section className="settings-section">
          <h3>Reminders</h3>
          <label className="settings-toggle">
            <b>Alerts</b>
            <input
              type="checkbox"
              checked={notifications}
              onChange={async (e) => {
                if (e.target.checked) {
                  if ("Notification" in window && Notification.permission === "default") {
                    const p = await Notification.requestPermission();
                    setNotifications(p === "granted");
                  } else setNotifications("Notification" in window && Notification.permission === "granted");
                } else setNotifications(false);
              }}
            />
          </label>
          <button type="button" className="settings-permission" onClick={onRequestReminderPermission}>Allow browser alerts</button>
        </section>

        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn-quiet" onClick={onClose}>Cancel</button>
          <div className="actions-spacer" />
          <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save"} <Check size={16} /></button>
        </div>
      </form>
    </div>
  );
}

function StudyTimer({ onStartTask, tasks, user }) {
  const [hours, setHours] = useState(() => Number(localStorage.getItem("dayflow-study-hours") || 1));
  const [minutes, setMinutes] = useState(() => Number(localStorage.getItem("dayflow-study-minutes") || 0));
  const [remaining, setRemaining] = useState(() => Number(localStorage.getItem("dayflow-study-remaining") || 3600));
  const [running, setRunning] = useState(false);
  const [label, setLabel] = useState("Study session");
  const [sessions, setSessions] = useState(() => Number(localStorage.getItem("dayflow-study-sessions") || 0));
  const [total, setTotal] = useState(() => Number(localStorage.getItem("dayflow-study-total") || 0));
  const [saveError, setSaveError] = useState("");
  const duration = Math.max(60, Math.min(43200, hours * 3600 + minutes * 60));

  useEffect(() => { localStorage.setItem("dayflow-study-hours", hours); localStorage.setItem("dayflow-study-minutes", minutes); }, [hours, minutes]);

  useEffect(() => {
    if (!user?.uid || !firebaseReady) return;
    return onSnapshot(collection(db, "users", user.uid, "studySessions"), (snapshot) => {
      const rows = snapshot.docs.map((d) => d.data());
      setSessions(rows.length);
      setTotal(rows.reduce((sum, row) => sum + Number(row.durationMinutes || 0), 0));
    }, (error) => {
      console.error("Study history sync failed:", error);
      setSaveError("Sync error.");
    });
  }, [user?.uid]);

  async function completeSession() {
    const record = { title: label.trim().slice(0, 100) || "Study session", durationSeconds: duration, durationMinutes: Math.round(duration / 60), completedAt: serverTimestamp(), date: dateKey(new Date()), createdAt: serverTimestamp() };
    if (user?.uid && firebaseReady) {
      try { await addDoc(collection(db, "users", user.uid, "studySessions"), record); setSaveError(""); }
      catch (error) { console.error("Study session save failed:", error); setSaveError("Cloud save failed."); }
    } else {
      setSaveError("");
      const nextSessions = sessions + 1, nextTotal = total + Math.round(duration / 60);
      localStorage.setItem("dayflow-study-sessions", nextSessions);
      localStorage.setItem("dayflow-study-total", nextTotal);
      setSessions(nextSessions);
      setTotal(nextTotal);
    }
    if ("Notification" in window && Notification.permission === "granted") new Notification("Session complete");
  }

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setRemaining((v) => {
      if (v <= 1) { setRunning(false); void completeSession(); localStorage.setItem("dayflow-study-remaining", "0"); return 0; }
      const next = v - 1;
      localStorage.setItem("dayflow-study-remaining", next);
      return next;
    }), 1000);
    return () => clearInterval(id);
  }, [running, duration, user?.uid, label]);

  const hh = Math.floor(remaining / 3600), mm = Math.floor((remaining % 3600) / 60), ss = remaining % 60;
  const display = [hh, mm, ss].map((v) => String(v).padStart(2, "0")).join(":");
  const weekStart = addDays(new Date(), -((new Date().getDay() + 6) % 7));
  const weekTasks = tasks.filter((t) => t.date >= dateKey(weekStart) && t.date <= dateKey(addDays(weekStart, 6)));
  const completed = weekTasks.filter((t) => t.completed).length;
  const completionRate = weekTasks.length ? Math.round((completed / weekTasks.length) * 100) : 0;
  const studyDone = weekTasks.filter((t) => t.category === "Study" && t.completed).length;
  const categorySummary = ["Study", "Work", "Personal", "Health"].map((name) => ({ name, count: weekTasks.filter((t) => t.category === name && t.completed).length }));

  function apply() { const d = Math.max(60, Math.min(43200, hours * 3600 + minutes * 60)); setRemaining(d); localStorage.setItem("dayflow-study-remaining", d); setRunning(false); }
  function reset() { setRunning(false); setRemaining(duration); localStorage.setItem("dayflow-study-remaining", duration); }

  return (
    <section className="study-page">
      <div className="study-heading">
        <h1>Focus Timer</h1>
        <span className="study-live"><i /> LIVE</span>
      </div>
      <div className="study-layout">
        <div className="study-timer-card">
          <div className="study-session-label"><Timer size={17} /> DEEP WORK SESSION</div>
          <input className="study-session-name" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Session name" />
          <div className="study-clock">{display}</div>
          <div className="study-clock-caption">{remaining === 0 ? "Completed" : running ? "In progress..." : "Ready when you are"}</div>
          <div className="study-controls">
            <button className="btn-primary study-start" onClick={() => { if (remaining === 0) reset(); setRunning((v) => !v); }}>
              {running ? <Pause size={18} /> : <Play size={18} />} {running ? "Pause" : "Start"}
            </button>
            <button className="study-reset" onClick={reset} aria-label="Reset timer"><RotateCcw size={17} /></button>
          </div>
          <div className="study-duration">
            <div className="duration-fields">
              <label><input type="number" min="0" max="12" disabled={running} value={hours} onChange={(e) => setHours(Math.min(12, Math.max(0, Number(e.target.value))))} /><small>Hr</small></label>
              <b>:</b>
              <label><input type="number" min="0" max="59" disabled={running} value={minutes} onChange={(e) => setMinutes(Math.min(59, Math.max(0, Number(e.target.value))))} /><small>Min</small></label>
              <button onClick={apply} disabled={running}>Set</button>
            </div>
          </div>
          {saveError && <p className="form-error">{saveError}</p>}
        </div>

        <aside className="study-side">
          <div className="study-insight">
            <div className="study-metric"><strong>{sessions}</strong><span>Sessions</span></div>
            <div className="study-metric"><strong>{Math.floor(total / 60)}h {total % 60}m</strong><span>Focus time</span></div>
            <div className="study-metric"><strong>{completed}</strong><span>Tasks done</span></div>
          </div>
          <div className="weekly-report">
            <div className="weekly-report-score"><strong>{completionRate}%</strong><span>Weekly velocity</span></div>
            <div className="weekly-report-track"><i style={{ width: completionRate + "%" }} /></div>
            <div className="weekly-report-stats"><span><b>{completed}/{weekTasks.length}</b> done</span><span><b>{studyDone}</b> study</span></div>
            <div className="weekly-report-categories">{categorySummary.map((x) => <span key={x.name}>{x.name}<b>{x.count}</b></span>)}</div>
          </div>
          <div className="study-templates">
            <div>
              {[15, 25, 45, 60, 90, 120].map((n) => (
                <button key={n} onClick={() => { setHours(Math.floor(n / 60)); setMinutes(n % 60); setRemaining(n * 60); localStorage.setItem("dayflow-study-remaining", n * 60); setRunning(false); }}>
                  {n < 60 ? n + "m" : n / 60 + "h"}
                </button>
              ))}
            </div>
          </div>
          <button className="study-add-task" onClick={onStartTask}><Plus size={16} /> Add task</button>
        </aside>
      </div>
    </section>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="day-empty">
      <div className="empty-illustration"><CalendarDays size={22} /></div>
      <h3>No tasks scheduled</h3>
      <button className="btn-primary" onClick={onAdd}><Plus size={16} /> Add task</button>
    </div>
  );
}

function GoogleMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.91c-.58 2.96-2.26 5.48-4.73 7.18l7.63 5.91c4.45-4.11 7.17-10.17 7.17-17.56z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.89l-7.63-5.91c-2.12 1.42-4.84 2.26-8.27 2.26-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function MarketingPage({ onStart, onSignIn, onGoogleSignIn, onDemo }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="marketing-shell">
      <header className="marketing-nav">
        <a className="marketing-brand" href="#home" aria-label="DayFlow home">
          <span className="marketing-brand-icon"><Sparkles size={19} /></span>dayflow<span>.</span>
        </a>
        <button className="marketing-menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation"><Menu size={20} /></button>
        <nav className={menuOpen ? "marketing-links marketing-links-open" : "marketing-links"}>
          <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>Workflow</a>
          <a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a>
        </nav>
        <div className="marketing-nav-actions">
          <button className="marketing-google-login" onClick={onGoogleSignIn} aria-label="Google sign in" title="Google"><GoogleMark size={19} /></button>
          <button className="marketing-login" onClick={onSignIn}>Sign in</button>
          <button className="marketing-nav-cta" onClick={onStart}>Start <ArrowRight size={15} /></button>
        </div>
      </header>

      <main id="home">
        <section className="marketing-hero">
          <div className="hero-copy">
            <div className="hero-badge"><Zap size={14} /> Built for high-focus days</div>
            <h1>Plan less.<br />Do <span>more.</span></h1>
            <p className="hero-description">Tasks, calendar, and deep-work focus timer unified in one calm, keyboard-first workspace.</p>
            <div className="hero-actions">
              <button className="hero-primary" onClick={onStart}>Get started free <ArrowRight size={17} /></button>
              <button className="hero-secondary" onClick={onDemo}>Try live demo</button>
            </div>
          </div>

          <div className="hero-visual" aria-label="Calendar preview">
            <div className="preview-window">
              <div className="preview-top">
                <div className="preview-dots"><i /><i /><i /></div>
                <span>DAYFLOW WORKSPACE</span>
                <span className="preview-user">D</span>
              </div>
              <div className="preview-content">
                <div className="preview-sidebar">
                  <div className="preview-logo"><Sparkles size={14} /> dayflow.</div>
                  <div className="preview-nav-active"><CalendarDays size={13} /> Calendar</div>
                  <div><ListTodo size={13} /> Today</div>
                  <div><Timer size={13} /> Timer</div>
                </div>
                <div className="preview-main">
                  <div className="preview-calendar">
                    <div className="preview-month"><b>November 2026</b><span>‹ ›</span></div>
                    <div className="preview-days">
                      {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                        <div key={i}><small>{d}</small><b className={i === 4 ? "preview-today" : ""}>{16 + i}</b></div>
                      ))}
                    </div>
                    <div className="preview-events">
                      <div className="preview-event event-purple">Study · 09:00 — Deep Work</div>
                      <div className="preview-event event-blue">Work · 11:30 — Sprint Review</div>
                      <div className="preview-event event-orange">Personal · 16:00 — Evening Run</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="marketing-section" id="features">
          <div className="section-intro"><h2>Everything in sync</h2></div>
          <div className="feature-grid">
            <article className="feature-card">
              <div className="feature-icon feature-lilac"><CalendarDays size={21} /></div>
              <h3>Fluid Calendar</h3>
              <p>Switch seamlessly between Month, Week, and Day views with instant drag-and-drop rescheduling.</p>
            </article>
            <article className="feature-card">
              <div className="feature-icon feature-blue"><ShieldCheck size={21} /></div>
              <h3>Real-time Cloud Sync</h3>
              <p>Powered by Firebase so your schedule, recurring blocks, and completion stats stay live everywhere.</p>
            </article>
            <article className="feature-card">
              <div className="feature-icon feature-peach"><Timer size={21} /></div>
              <h3>Focus Timer & Velocity</h3>
              <p>Custom session durations paired with automatic weekly velocity tracking across every category.</p>
            </article>
          </div>
        </section>

        <section className="how-section" id="how-it-works">
          <div className="how-heading"><h2>Workflow</h2></div>
          <div className="how-steps">
            <article><b>01</b><h3>Create space</h3><p>Launch a personal workspace in seconds—online or offline.</p></article>
            <article><b>02</b><h3>Time-block tasks</h3><p>Capture quick tasks or set recurring study and work blocks.</p></article>
            <article><b>03</b><h3>Execute with focus</h3><p>Launch the live timer and watch your daily progress ring close.</p></article>
          </div>
        </section>

        <section className="pricing-section" id="pricing">
          <div><h2>Simple pricing</h2></div>
          <div className="pricing-card">
            <div className="pricing-price">Free</div>
            <ul>
              <li><Check size={15} /> Unlimited tasks & recurring schedules</li>
              <li><Check size={15} /> Month, week, and day calendar views</li>
              <li><Check size={15} /> Real-time Firebase cloud sync</li>
            </ul>
            <button onClick={onStart}>Get started <ArrowRight size={16} /></button>
          </div>
        </section>
      </main>

      <footer className="marketing-footer">
        <a className="marketing-brand" href="#home"><span className="marketing-brand-icon"><Sparkles size={17} /></span>dayflow<span>.</span></a>
        <span>© 2026 DayFlow</span>
      </footer>
    </div>
  );
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [visibleMonth, setVisibleMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [view, setView] = useState("month");
  const [modal, setModal] = useState(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [workspaceError, setWorkspaceError] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [defaultCategory, setDefaultCategory] = useState(() => localStorage.getItem("dayflow-last-category") || "Study");
  const [toast, setToast] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("Personal workspace");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("dayflow-theme") || "light");
  const [notifications, setNotifications] = useState(() => localStorage.getItem("dayflow-notifications") !== "off");

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!firebaseReady) {
      try { setTasks(JSON.parse(localStorage.getItem("dayflow-tasks") || "[]")); } catch { setTasks([]); }
      return;
    }
    return onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setWorkspace(null);
      setWorkspaceError("");
      if (!user) return;
      try {
        const personalWorkspace = await ensurePersonalWorkspace(user);
        setWorkspace(personalWorkspace);
        const needsOnboarding = !user.displayName?.trim() || localStorage.getItem("dayflow-onboarding-pending") === "1";
        if (needsOnboarding) {
          setProfileName(user.displayName || "");
          setWorkspaceName(personalWorkspace.name || "Personal workspace");
          setOnboardingOpen(true);
          localStorage.removeItem("dayflow-onboarding-pending");
        }
      } catch (error) {
        console.error("Workspace setup failed:", error);
        setWorkspaceError("Workspace error.");
      }
    });
  }, []);

  useEffect(() => {
    if (!authUser || !firebaseReady) return;
    return onSnapshot(doc(db, "users", authUser.uid), (snapshot) => {
      const profile = snapshot.data() || {};
      setAuthUser((current) => current?.uid === authUser.uid
        ? { ...current, profilePhotoDataUrl: profile.profilePhotoDataUrl || "" }
        : current);
    }, (error) => console.error("Profile sync failed:", error));
  }, [authUser?.uid]);

  useEffect(() => {
    if (!authUser || !firebaseReady) {
      try { setTasks(JSON.parse(localStorage.getItem("dayflow-tasks") || "[]")); } catch { setTasks([]); }
      return;
    }
    return onSnapshot(
      collection(db, "users", authUser.uid, "tasks"),
      (snapshot) => setTasks(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      () => notify("Sync error.")
    );
  }, [authUser]);

  useEffect(() => {
    if (!authUser) localStorage.setItem("dayflow-tasks", JSON.stringify(tasks));
  }, [tasks, authUser]);

  useEffect(() => { localStorage.setItem("dayflow-theme", theme); }, [theme]);
  useEffect(() => { localStorage.setItem("dayflow-notifications", notifications ? "on" : "off"); }, [notifications]);

  useEffect(() => {
    if (!notifications || !("Notification" in window) || Notification.permission !== "granted") return;
    const checkReminders = () => {
      const now = Date.now();
      tasks.forEach((task) => {
        if (task.completed || !task.reminder || task.reminder === "none" || !task.startTime) return;
        const due = new Date(task.date + "T" + task.startTime).getTime() - Number(task.reminder) * 60000;
        const key = "dayflow-reminded-" + task.id + "-" + task.date;
        if (now >= due && now < due + 60000 && !localStorage.getItem(key)) {
          new Notification(task.title, { body: Number(task.reminder) === 0 ? "Now" : "In " + task.reminder + "m" });
          localStorage.setItem(key, "1");
        }
      });
    };
    checkReminders();
    const timer = window.setInterval(checkReminders, 30000);
    return () => window.clearInterval(timer);
  }, [tasks, notifications]);

  function notify(message) {
    setToast(message);
    window.clearTimeout(window.__dayflowToast);
    window.__dayflowToast = window.setTimeout(() => setToast(""), 2400);
  }

  const completedCount = tasks.filter((t) => t.completed).length;
  const todayTasks = tasks.filter((t) => t.date === dateKey(today));
  const todayDone = todayTasks.filter((t) => t.completed).length;
  const progress = todayTasks.length ? Math.round((todayDone / todayTasks.length) * 100) : 0;
  const selectedTasks = tasks.filter((t) => t.date === dateKey(selectedDate)).sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
  const visibleTasks = selectedTasks.filter((t) => (filter === "All" || t.category === filter) && (!search || t.title.toLowerCase().includes(search.toLowerCase())));
  const upcoming = tasks.filter((t) => !t.completed && t.date >= dateKey(today)).sort((a, b) => (a.date + (a.startTime || "")).localeCompare(b.date + (b.startTime || ""))).slice(0, 4);
  const weekStart = addDays(selectedDate, -((selectedDate.getDay() + 6) % 7));
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthCells = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const start = addDays(first, -((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [visibleMonth]);

  async function saveTask(data) {
    if (data.category) {
      setDefaultCategory(data.category);
      localStorage.setItem("dayflow-last-category", data.category);
    }
    if (modal?.task) {
      const updateData = { ...data, repeat: "none" };
      if (authUser && firebaseReady) await updateDoc(doc(db, "users", authUser.uid, "tasks", modal.task.id), updateData);
      else setTasks((items) => items.map((t) => t.id === modal.task.id ? { ...t, ...updateData } : t));
      notify("Updated");
    } else {
      const dates = [data.date];
      if (data.repeat !== "none") {
        const base = fromKey(data.date);
        for (let i = 1; i < 12; i++) {
          const next = data.repeat === "daily"
            ? addDays(base, i)
            : data.repeat === "weekly"
              ? addDays(base, i * 7)
              : new Date(base.getFullYear(), base.getMonth() + i, Math.min(base.getDate(), new Date(base.getFullYear(), base.getMonth() + i + 1, 0).getDate()));
          dates.push(dateKey(next));
        }
      }
      const records = dates.map((date, index) => ({
        ...data,
        date,
        repeat: data.repeat === "none" ? "none" : data.repeat,
        seriesId: data.repeat === "none" ? null : (modal?.seriesId || makeId()),
        occurrence: index,
        completed: false,
        createdAt: new Date().toISOString()
      }));
      if (authUser && firebaseReady) {
        for (const record of records) {
          const { repeat, ...persisted } = record;
          await addDoc(collection(db, "users", authUser.uid, "tasks"), { ...persisted, createdAt: serverTimestamp() });
        }
      } else {
        setTasks((items) => [...items, ...records.map((task) => ({ ...task, id: makeId() }))]);
      }
      notify(data.repeat === "none" ? "Added" : "12 added");
    }
    setModal(null);
  }

  async function addQuickTask(e) {
    e.preventDefault();
    const title = quickTaskTitle.trim();
    if (!title) return;
    try {
      await saveTask({ title, notes: "", date: dateKey(selectedDate || today), startTime: "", endTime: "", priority: "Medium", category: defaultCategory, repeat: "none", reminder: "none" });
      setQuickTaskTitle("");
    } catch (error) {
      console.error("Quick task creation failed:", error);
      notify("Failed");
    }
  }

  async function removeTask(id) {
    if (authUser && firebaseReady) await deleteDoc(doc(db, "users", authUser.uid, "tasks", id));
    else setTasks((items) => items.filter((t) => t.id !== id));
    setModal(null);
    notify("Deleted");
  }

  async function toggleTask(task) {
    const completed = !task.completed;
    if (authUser && firebaseReady) await updateDoc(doc(db, "users", authUser.uid, "tasks", task.id), { completed });
    else setTasks((items) => items.map((t) => t.id === task.id ? { ...t, completed } : t));
  }

  async function signInWithGoogle() {
    if (!firebaseReady || !auth) {
      setAuthError("Firebase not configured.");
      setAuthOpen(true);
      return;
    }
    setAuthBusy(true); setAuthError("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
      setAuthOpen(false);
      notify("Signed in");
    } catch (e) {
      setAuthError(e.message || "Sign-in failed.");
      setAuthOpen(true);
    } finally { setAuthBusy(false); }
  }

  async function authenticate(email, password, mode, fullName = "") {
    setAuthBusy(true); setAuthError("");
    try {
      if (mode === "signup") {
        localStorage.setItem("dayflow-onboarding-pending", "1");
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        if (fullName.trim()) await updateProfile(credential.user, { displayName: fullName.trim() });
      } else await signInWithEmailAndPassword(auth, email, password);
      setAuthOpen(false);
      notify("Signed in");
    } catch (e) {
      localStorage.removeItem("dayflow-onboarding-pending");
      setAuthError(e.message);
    } finally { setAuthBusy(false); }
  }

  async function completeOnboarding() {
    const cleanName = profileName.trim();
    const cleanWorkspace = workspaceName.trim();
    if (cleanName.length < 2 || cleanWorkspace.length < 2) {
      setProfileError("Min 2 characters.");
      return;
    }
    setProfileBusy(true); setProfileError("");
    try {
      await ensurePersonalWorkspace(authUser);
      await updateProfile(authUser, { displayName: cleanName });
      await updateDoc(doc(db, "users", authUser.uid), { displayName: cleanName, updatedAt: serverTimestamp() });
      await updateDoc(doc(db, "workspaces", authUser.uid), { name: cleanWorkspace, updatedAt: serverTimestamp() });
      setAuthUser(auth.currentUser);
      setWorkspace((current) => ({ ...(current || {}), id: authUser.uid, name: cleanWorkspace, plan: "free", role: "owner" }));
      setOnboardingOpen(false);
      notify("Saved");
    } catch (error) {
      console.error("Profile setup failed:", error);
      setProfileError("Save failed.");
    } finally { setProfileBusy(false); }
  }

  async function requestReminderPermission() {
    if (!("Notification" in window)) { notify("Unsupported"); return; }
    const result = await Notification.requestPermission();
    if (result === "granted") { setNotifications(true); notify("Enabled"); }
    else notify("Denied");
  }

  async function saveSettings(name, space) {
    if (!authUser || !firebaseReady) return;
    if (name.trim().length < 2 || space.trim().length < 2) { setSettingsError("Min 2 characters."); return; }
    setSettingsBusy(true); setSettingsError("");
    try {
      await updateProfile(authUser, { displayName: name.trim() });
      await updateDoc(doc(db, "users", authUser.uid), { displayName: name.trim(), updatedAt: serverTimestamp() });
      await updateDoc(doc(db, "workspaces", authUser.uid), { name: space.trim(), updatedAt: serverTimestamp() });
      setAuthUser(auth.currentUser);
      setWorkspace((cur) => ({ ...cur, name: space.trim() }));
      setSettingsOpen(false);
      notify("Saved");
    } catch (e) {
      console.error("Settings save failed", e);
      setSettingsError("Save failed.");
    } finally { setSettingsBusy(false); }
  }

  function changeMonth(amount) { setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + amount, 1)); }
  function chooseDate(date) {
    setSelectedDate(date);
    if (date.getMonth() !== visibleMonth.getMonth()) setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }
  function openNewTask(date = selectedDate) { setModal({ date }); }
  function editTask(task) { setModal({ task, date: fromKey(task.date) }); }

  if (!authUser && !showDashboard) {
    return (
      <>
        <style>{GLOBAL_STYLES}</style>
        <MarketingPage
          onStart={() => { if (firebaseReady) setAuthOpen(true); else setShowDashboard(true); }}
          onSignIn={() => { if (firebaseReady) setAuthOpen(true); else setShowDashboard(true); }}
          onGoogleSignIn={signInWithGoogle}
          onDemo={() => setShowDashboard(true)}
        />
        {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSubmit={authenticate} busy={authBusy} error={authError} />}
        {onboardingOpen && authUser && (
          <OnboardingModal
            name={profileName} workspaceName={workspaceName}
            setName={setProfileName} setWorkspaceName={setWorkspaceName}
            onSubmit={completeOnboarding} busy={profileBusy} error={profileError}
          />
        )}
        {toast && <div className="toast"><CheckCircle2 size={17} />{toast}</div>}
      </>
    );
  }

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <div className={"app-shell " + (isDark ? "theme-dark" : "")}>
      <style>{GLOBAL_STYLES}</style>
      <aside className={"sidebar " + (mobileNav ? "sidebar-open" : "")}>
        <div className="brand">
          <div className="brand-icon"><Sparkles size={19} strokeWidth={2.4} /></div>
          <span>dayflow<span className="brand-period">.</span></span>
        </div>

        <nav className="main-nav">
          <button className={"nav-item " + (view !== "timer" ? "nav-active" : "")} onClick={() => { setView("month"); setMobileNav(false); }}>
            <CalendarDays size={18} /> Calendar <span className="nav-count">{tasks.length}</span>
          </button>
          <button className={"nav-item " + (view === "timer" ? "nav-active" : "")} onClick={() => { setView("timer"); setMobileNav(false); }}>
            <Timer size={18} /> Timer
          </button>
          <button className="nav-item" onClick={() => { chooseDate(today); setView("day"); setMobileNav(false); }}>
            <ListTodo size={18} /> Today
          </button>
        </nav>

        <div className="sidebar-divider" />

        <div className="workspace-label category-heading">
          CATEGORIES <button aria-label="Add task" onClick={() => openNewTask()}><Plus size={15} /></button>
        </div>

        <div className="category-nav">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => { setFilter(filter === c ? "All" : c); setView("month"); setMobileNav(false); }}
              className={"category-nav-item " + (filter === c ? "category-nav-selected" : "")}
            >
              <span className={"category-dot " + COLORS[c]} />{c}
              <span className="category-total">{tasks.filter((t) => t.category === c).length}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="profile-row">
            <div className="avatar">
              {(authUser?.profilePhotoDataUrl || authUser?.photoURL)
                ? <img src={authUser.profilePhotoDataUrl || authUser.photoURL} alt="" />
                : authUser?.displayName?.trim()?.[0]?.toUpperCase() || authUser?.email?.[0]?.toUpperCase() || "D"}
            </div>
            <div className="profile-copy">
              <strong>{authUser ? (authUser.displayName || authUser.email.split("@")[0]) : "Local"}</strong>
              <span>{authUser ? "Cloud" : "Offline"}</span>
            </div>
            <button
              className="profile-action"
              onClick={() => authUser ? setSettingsOpen(true) : firebaseReady ? setAuthOpen(true) : notify("Offline mode")}
              title={authUser ? "Settings" : "Sign in"}
            >
              {authUser ? <Settings2 size={17} /> : <LogIn size={17} />}
            </button>
          </div>
        </div>
      </aside>

      {mobileNav && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <IconButton label="Menu" className="menu-toggle" onClick={() => setMobileNav(!mobileNav)}><Menu size={20} /></IconButton>
            <span className="breadcrumb">
              {workspace?.name || "Workspace"} <span>/</span> <b>{view === "timer" ? "Timer" : "Calendar"}</b>
            </span>
          </div>
          <div className="topbar-right">
            <button className="kbd-hint" onClick={() => setCmdOpen(true)} title="Command Palette">
              <Command size={13} /> <span>⌘K</span>
            </button>
            {workspaceError && <span className="workspace-warning">{workspaceError}</span>}
            <div className={"sync-status " + (authUser ? "synced" : "")}>
              {authUser ? <Cloud size={15} /> : <CloudOff size={15} />}
              <span>{authUser ? "Synced" : "Local"}</span>
            </div>
            {authUser
              ? <button className="top-signin" onClick={() => signOut(auth)}><LogOut size={15} /> Out</button>
              : <button className="top-signin" onClick={() => firebaseReady ? setAuthOpen(true) : notify("Offline mode")}><LogIn size={15} /> In</button>}
            <button className="top-avatar top-avatar-button" onClick={() => authUser && setSettingsOpen(true)} aria-label="Settings">
              {authUser?.photoURL
                ? <img src={authUser.photoURL} alt="" />
                : authUser?.displayName?.trim()?.[0]?.toUpperCase() || authUser?.email?.[0]?.toUpperCase() || "D"}
            </button>
          </div>
        </header>

        <section className="page-content">
          <div className="welcome-row" style={{ alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: "1.55rem", margin: 0 }}>{greeting()}</h1>
              <span className="date-overline">{fullDay(today)}</span>
            </div>
            <form onSubmit={addQuickTask} style={{ display: "flex", gap: 8, flex: 1, minWidth: 260, maxWidth: 460, marginLeft: "auto" }}>
              <input
                className="field-input"
                style={{ flex: 1, height: 38 }}
                value={quickTaskTitle}
                onChange={(e) => setQuickTaskTitle(e.target.value)}
                placeholder="Quick add task..."
                aria-label="New task"
              />
              <button className="btn-primary" type="submit" disabled={!quickTaskTitle.trim()}>
                <Plus size={16} /> Add
              </button>
              <IconButton label="Options" onClick={() => openNewTask()}><Settings2 size={17} /></IconButton>
            </form>
          </div>

          {view !== "timer" && (
            <section className="stats-grid">
              <div className="stat-card stat-highlight">
                <div className="stat-top"><span>Today</span><span className="stat-icon"><Sparkles size={17} /></span></div>
                <div className="stat-main">
                  <strong>{progress}<small>%</small></strong>
                  <div className="progress-ring" style={{ "--progress": (progress * 3.6) + "deg" }}><div>{todayDone}<small>/{todayTasks.length}</small></div></div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-top"><span>Week</span><span className="stat-icon pale-blue"><CalendarDays size={17} /></span></div>
                <div className="stat-number">{tasks.filter((t) => t.date >= dateKey(weekStart) && t.date <= dateKey(addDays(weekStart, 6))).length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-top"><span>Done</span><span className="stat-icon pale-green"><CheckCircle2 size={17} /></span></div>
                <div className="stat-number">{completedCount}</div>
              </div>
              <div className="stat-card">
                <div className="stat-top"><span>Upcoming</span><span className="stat-icon pale-amber"><Clock3 size={17} /></span></div>
                <div className="stat-number">{upcoming.length}</div>
              </div>
            </section>
          )}

          {view === "timer" ? (
            <StudyTimer tasks={tasks} user={authUser} onStartTask={() => setModal({ date: today })} />
          ) : (
            <section className="planner-layout">
              <div className="calendar-card">
                <div className="calendar-toolbar">
                  <h2>
                    {view === "day"
                      ? fullDay(selectedDate)
                      : view === "week"
                        ? "Week · " + selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        : monthLabel(visibleMonth)}
                  </h2>
                  <div className="calendar-actions">
                    <button className="today-button" onClick={() => { chooseDate(today); setView("month"); }}>Today</button>
                    <div className="view-switch">
                      {["month", "week", "day"].map((v) => (
                        <button key={v} onClick={() => setView(v)} className={view === v ? "view-selected" : ""}>{v[0].toUpperCase() + v.slice(1)}</button>
                      ))}
                    </div>
                    <div className="month-arrows">
                      <IconButton label="Prev" onClick={() => view === "week" ? chooseDate(addDays(selectedDate, -7)) : view === "day" ? chooseDate(addDays(selectedDate, -1)) : changeMonth(-1)}><ChevronLeft size={17} /></IconButton>
                      <IconButton label="Next" onClick={() => view === "week" ? chooseDate(addDays(selectedDate, 7)) : view === "day" ? chooseDate(addDays(selectedDate, 1)) : changeMonth(1)}><ChevronRight size={17} /></IconButton>
                    </div>
                  </div>
                </div>

                <div className="calendar-legend">
                  <span><i className="legend-dot violet" />Study</span>
                  <span><i className="legend-dot blue" />Work</span>
                  <span><i className="legend-dot amber" />Personal</span>
                  <span><i className="legend-dot green" />Health</span>
                </div>

                {view === "month" && (
                  <div className="month-calendar">
                    <div className="weekday-row">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d}>{d}</div>)}</div>
                    <div className="month-grid">
                      {monthCells.map((date) => {
                        const dayTasks = tasks.filter((t) => t.date === dateKey(date) && (filter === "All" || t.category === filter));
                        const inMonth = date.getMonth() === visibleMonth.getMonth();
                        return (
                          <button
                            key={dateKey(date)}
                            className={"month-cell " + (!inMonth ? "outside-month " : "") + (sameDay(date, selectedDate) ? "selected-cell " : "") + (sameDay(date, today) ? "current-cell" : "")}
                            onClick={() => chooseDate(date)}
                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("drop-target"); }}
                            onDragLeave={(e) => e.currentTarget.classList.remove("drop-target")}
                            onDrop={async (e) => {
                              e.preventDefault();
                              e.currentTarget.classList.remove("drop-target");
                              const id = e.dataTransfer.getData("text/dayflow-task");
                              const t = tasks.find((x) => x.id === id);
                              if (t && t.date !== dateKey(date)) {
                                if (authUser && firebaseReady) await updateDoc(doc(db, "users", authUser.uid, "tasks", id), { date: dateKey(date) });
                                else setTasks((items) => items.map((x) => x.id === id ? { ...x, date: dateKey(date) } : x));
                                notify("Moved");
                              }
                            }}
                          >
                            <span className="cell-date">{date.getDate()}</span>
                            <div className="cell-events">
                              {dayTasks.slice(0, 2).map((t) => <TaskPill key={t.id} task={t} onClick={editTask} onToggle={toggleTask} compact />)}
                              {dayTasks.length > 2 && <span className="more-events">+{dayTasks.length - 2}</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {view === "week" && (
                  <div className="week-grid">
                    {weekDates.map((date) => {
                      const dayTasks = tasks.filter((t) => t.date === dateKey(date) && (filter === "All" || t.category === filter)).sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
                      return (
                        <div
                          key={dateKey(date)}
                          className={"week-column " + (sameDay(date, today) ? "week-today" : "")}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={async (e) => {
                            e.preventDefault();
                            const id = e.dataTransfer.getData("text/dayflow-task");
                            const t = tasks.find((x) => x.id === id);
                            if (t && t.date !== dateKey(date)) {
                              if (authUser && firebaseReady) await updateDoc(doc(db, "users", authUser.uid, "tasks", id), { date: dateKey(date) });
                              else setTasks((items) => items.map((x) => x.id === id ? { ...x, date: dateKey(date) } : x));
                              notify("Moved");
                            }
                          }}
                        >
                          <button className="week-day-head" onClick={() => chooseDate(date)}><span>{shortDay(date)}</span><b>{date.getDate()}</b></button>
                          <div className="week-events">
                            {dayTasks.map((t) => <TaskPill key={t.id} task={t} onClick={editTask} onToggle={toggleTask} />)}
                            <button className="week-add" onClick={() => { chooseDate(date); openNewTask(date); }}><Plus size={15} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {view === "day" && (
                  <div className="day-agenda">
                    {selectedTasks.length ? selectedTasks.map((t) => (
                      <div className="day-event" key={t.id}>
                        <div className="day-event-time">{t.startTime || "Anytime"}<span>{t.endTime || ""}</span></div>
                        <div className={"day-event-bar tone-" + (COLORS[t.category] || "violet")}>
                          <div>
                            <strong className={t.completed ? "strike" : ""}>{t.title}</strong>
                            <span>{t.category} · {t.priority}</span>
                          </div>
                          <div className="day-event-actions">
                            <button onClick={() => toggleTask(t)} aria-label="Toggle">{t.completed ? <CheckCircle2 size={18} /> : <span className="empty-check" />}</button>
                            <button onClick={() => editTask(t)} aria-label="Edit"><Pencil size={16} /></button>
                          </div>
                        </div>
                      </div>
                    )) : <EmptyState onAdd={() => openNewTask(selectedDate)} />}
                  </div>
                )}

                <div className="calendar-footer">
                  <span><span className="footer-dot" /> {tasks.filter((t) => t.date === dateKey(selectedDate)).length} tasks</span>
                  <button onClick={() => setView("day")}>Day <ArrowRight size={15} /></button>
                </div>
              </div>

              <aside className="agenda-card">
                <div className="agenda-heading">
                  <h2>Focus</h2>
                  <button className="more-button" onClick={() => setView("day")} aria-label="Day view"><MoreHorizontal size={19} /></button>
                </div>

                <div className="agenda-date">
                  <div className="agenda-date-number">{selectedDate.getDate()}</div>
                  <div>
                    <strong>{selectedDate.toLocaleDateString("en-US", { weekday: "long" })}</strong>
                    <span>{selectedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                  </div>
                </div>

                <div className="agenda-progress">
                  <div><span>Done</span><b>{selectedTasks.filter((t) => t.completed).length}/{selectedTasks.length}</b></div>
                  <div className="progress-track"><span style={{ width: (selectedTasks.length ? (selectedTasks.filter((t) => t.completed).length / selectedTasks.length) * 100 : 0) + "%" }} /></div>
                </div>

                <div className="agenda-search">
                  <Search size={14} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." aria-label="Search" />
                </div>

                <div className="agenda-list">
                  {visibleTasks.length ? visibleTasks.map((t) => (
                    <div className={"agenda-task " + (t.completed ? "agenda-task-done" : "")} key={t.id}>
                      <button className="task-check" onClick={() => toggleTask(t)} aria-label={t.completed ? "Incomplete" : "Complete"}>{t.completed && <Check size={13} />}</button>
                      <button className="agenda-task-main" onClick={() => editTask(t)}>
                        <strong>{t.title}</strong>
                        <span><Clock3 size={12} /> {t.startTime || "Anytime"}{t.endTime ? " – " + t.endTime : ""}</span>
                      </button>
                      <span className={"priority-mark priority-" + t.priority.toLowerCase()} title={t.priority}><Flag size={13} /></span>
                    </div>
                  )) : (
                    <div className="agenda-empty">
                      <div className="empty-illustration"><CalendarDays size={21} /></div>
                      <strong>No tasks</strong>
                      <button onClick={() => openNewTask(selectedDate)}><Plus size={15} /> Add</button>
                    </div>
                  )}
                </div>

                <button className="agenda-add" onClick={() => openNewTask(selectedDate)}><Plus size={16} /> Add task</button>

                <div className="upcoming-block">
                  <div className="upcoming-title">
                    <span>UPCOMING</span>
                    <button onClick={() => { setSelectedDate(today); setView("week"); }}>Week <ArrowRight size={13} /></button>
                  </div>
                  {upcoming.length ? upcoming.slice(0, 3).map((t) => (
                    <button key={t.id} className="upcoming-item" onClick={() => { chooseDate(fromKey(t.date)); editTask(t); }}>
                      <span className={"upcoming-marker " + COLORS[t.category]} />
                      <span className="upcoming-copy">
                        <strong>{t.title}</strong>
                        <small>{sameDay(fromKey(t.date), today) ? "Today" : fromKey(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {t.startTime || "Anytime"}</small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  )) : <p className="no-upcoming">None</p>}
                </div>
              </aside>
            </section>
          )}
        </section>
      </main>

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onNewTask={() => openNewTask(selectedDate)}
        onSwitchView={(v) => setView(v)}
        onToggleTheme={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
      />

      {modal && <TaskModal initial={modal.task} date={modal.date || selectedDate} onClose={() => setModal(null)} onSave={saveTask} onDelete={removeTask} />}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSubmit={authenticate} busy={authBusy} error={authError} />}
      {settingsOpen && authUser && (
        <SettingsModal
          user={{ ...authUser, photoURL: authUser.profilePhotoDataUrl || authUser.photoURL }}
          workspace={workspace}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
          onRequestReminderPermission={requestReminderPermission}
          saving={settingsBusy}
          error={settingsError}
          theme={theme}
          setTheme={setTheme}
          notifications={notifications}
          setNotifications={setNotifications}
        />
      )}
      {toast && <div className="toast"><CheckCircle2 size={17} />{toast}</div>}
    </div>
  );
}
