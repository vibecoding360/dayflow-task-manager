import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight,
  Clock3, Cloud, CloudOff, Flag, ListTodo, LogIn, LogOut, Timer, Play, Pause, RotateCcw,
  Menu, MoreHorizontal, Pencil, Plus, Search, Settings2, Sparkles, Trash2, X
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

function IconButton({ children, onClick, label, className = "" }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className={"icon-button " + className}>{children}</button>;
}

function TaskPill({ task, onClick, onToggle, compact = false }) {
  const tone = COLORS[task.category] || "violet";
  return (
    <span className="task-pill-wrap" style={{ display: "flex", alignItems: "center", gap: 3, minWidth: 0 }}>
      {onToggle && (
        <button
          type="button"
          aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
          title={task.completed ? "Incomplete" : "Complete"}
          onClick={(e) => { e.stopPropagation(); onToggle(task); }}
          style={{ width: 17, height: 17, flex: "0 0 17px", borderRadius: 5, border: "1px solid var(--line, #d8dce5)", background: task.completed ? "var(--accent, #7663d8)" : "transparent", color: "#fff", display: "grid", placeItems: "center", padding: 0, cursor: "pointer" }}
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
        <div className="onboarding-art">
          <div className="onboarding-orbit orbit-one" />
          <div className="onboarding-orbit orbit-two" />
          <div className="onboarding-spark"><Sparkles size={25} /></div>
          <span className="onboarding-art-check"><Check size={15} /></span>
        </div>
        <h2>Setup</h2>
        <label className="field-label">Name</label>
        <input className="field-input" required minLength="2" maxLength="60" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="field-label">Workspace</label>
        <input className="field-input" required minLength="2" maxLength="60" placeholder="Workspace" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} />
        {error && <p className="form-error">{error}</p>}
        <button className="btn-primary onboarding-submit" disabled={busy}>
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
        <h1>Timer</h1>
        <span className="study-live"><i /> LIVE</span>
      </div>
      <div className="study-layout">
        <div className="study-timer-card">
          <div className="study-session-label"><Timer size={17} /> SESSION</div>
          <input className="study-session-name" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Session name" />
          <div className="study-clock">{display}</div>
          <div className="study-clock-caption">{remaining === 0 ? "Done" : running ? "Running" : "Ready"}</div>
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
            <div className="study-metric"><strong>{completed}</strong><span>Study done</span></div>
          </div>
          <div className="weekly-report">
            <div className="weekly-report-score"><strong>{completionRate}%</strong><span>Weekly</span></div>
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
      <h3>No tasks</h3>
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
            <h1>Plan less.<br />Do <span>more.</span></h1>
            <p className="hero-description">Tasks, calendar, and focus timer in one place.</p>
            <div className="hero-actions">
              <button className="hero-primary" onClick={onStart}>Get started <ArrowRight size={17} /></button>
              <button className="hero-secondary" onClick={onDemo}>Try demo</button>
            </div>
          </div>

          <div className="hero-visual" aria-label="Calendar preview">
            <div className="visual-glow" />
            <div className="preview-window">
              <div className="preview-top">
                <div className="preview-dots"><i /><i /><i /></div>
                <span>WORKSPACE</span>
                <span className="preview-user">D</span>
              </div>
              <div className="preview-content">
                <div className="preview-sidebar">
                  <div className="preview-logo"><Sparkles size={14} /> dayflow.</div>
                  <div className="preview-nav-active"><CalendarDays size={13} /> Calendar</div>
                  <div><ListTodo size={13} /> Tasks</div>
                  <div><Flag size={13} /> Timer</div>
                </div>
                <div className="preview-main">
                  <div className="preview-calendar">
                    <div className="preview-month"><b>November 2026</b><span>‹ ›</span></div>
                    <div className="preview-days">
                      {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                        <div key={i}><small>{d}</small><b className={i === 2 ? "preview-today" : ""}>{9 + i}</b></div>
                      ))}
                    </div>
                    <div className="preview-events">
                      <div className="preview-event event-purple">Study · 09:00</div>
                      <div className="preview-event event-blue">Work · 11:30</div>
                      <div className="preview-event event-orange">Personal · 16:00</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="marketing-section" id="features">
          <div className="section-intro"><h2>Features</h2></div>
          <div className="feature-grid">
            <article className="feature-card feature-large">
              <div className="feature-icon feature-lilac"><CalendarDays size={21} /></div>
              <h3>Calendar</h3>
              <p>Month, week, and day views with drag rescheduling.</p>
            </article>
            <article className="feature-card">
              <div className="feature-icon feature-blue"><Cloud size={21} /></div>
              <h3>Cloud sync</h3>
              <p>Real-time sync via Firebase.</p>
            </article>
            <article className="feature-card">
              <div className="feature-icon feature-peach"><Sparkles size={21} /></div>
              <h3>Focus timer</h3>
              <p>Custom session durations and weekly stats.</p>
            </article>
          </div>
        </section>

        <section className="how-section" id="how-it-works">
          <div className="how-heading"><h2>Workflow</h2></div>
          <div className="how-steps">
            <article><b>01</b><h3>Create space</h3><p>Set up your workspace.</p></article>
            <article><b>02</b><h3>Add tasks</h3><p>Schedule dates and times.</p></article>
            <article><b>03</b><h3>Track progress</h3><p>Complete tasks and sessions.</p></article>
          </div>
        </section>

        <section className="pricing-section" id="pricing">
          <div><h2>Pricing</h2></div>
          <div className="pricing-card">
            <div className="pricing-price">Free</div>
            <ul>
              <li><Check size={15} /> Personal workspace</li>
              <li><Check size={15} /> Month, week, day views</li>
              <li><Check size={15} /> Cloud sync</li>
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
              <h1 style={{ fontSize: "1.45rem", margin: 0 }}>{greeting()}</h1>
              <span className="date-overline">{fullDay(today)}</span>
            </div>
            <form onSubmit={addQuickTask} style={{ display: "flex", gap: 8, flex: 1, minWidth: 260, maxWidth: 460, marginLeft: "auto" }}>
              <input
                className="field-input"
                style={{ flex: 1, height: 40 }}
                value={quickTaskTitle}
                onChange={(e) => setQuickTaskTitle(e.target.value)}
                placeholder="New task..."
                aria-label="New task"
              />
              <button className="btn-primary" type="submit" disabled={!quickTaskTitle.trim()} style={{ height: 40 }}>
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
            <StudyTimer tasks={tasks} user={authUser} onStartTask={() => setModal({ date: dateKey(today) })} />
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
