import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight,
  Clock3, Cloud, CloudOff, Flag, LayoutDashboard, ListTodo, LogIn, LogOut,
  Menu, MoreHorizontal, Pencil, Plus, Search, Settings2, Sparkles, Trash2, X
} from "lucide-react";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged
} from "firebase/auth";
import { auth, db, firebaseReady } from "./firebase";

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

function TaskPill({ task, onClick, compact = false }) {
  const tone = COLORS[task.category] || "violet";
  return <button type="button" onClick={(e) => { e.stopPropagation(); onClick(task); }} className={"task-pill tone-" + tone + (task.completed ? " is-done" : "") + (compact ? " task-pill-compact" : "")}>
    <span className="task-dot" /><span className="task-pill-title">{task.title}</span>
    {!compact && task.startTime && <span className="task-pill-time">{task.startTime}</span>}
  </button>;
}

function TaskModal({ initial, date, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [taskDate, setTaskDate] = useState(initial?.date || dateKey(date));
  const [startTime, setStartTime] = useState(initial?.startTime || "09:00");
  const [endTime, setEndTime] = useState(initial?.endTime || "10:00");
  const [priority, setPriority] = useState(initial?.priority || "Medium");
  const [category, setCategory] = useState(initial?.category || "Study");
  const [error, setError] = useState("");
  function submit(e) {
    e.preventDefault();
    if (!title.trim()) { setError("Give your task a name first."); return; }
    onSave({ title: title.trim(), notes: notes.trim(), date: taskDate, startTime, endTime, priority, category });
  }
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <form className="task-modal" onSubmit={submit}>
      <div className="modal-top"><div><span className="eyebrow">{initial ? "MAKE AN EDIT" : "A LITTLE PLAN"}</span><h2>{initial ? "Edit task" : "Add a task"}</h2></div><IconButton label="Close" onClick={onClose}><X size={19} /></IconButton></div>
      <label className="field-label">Task name</label><input autoFocus className="field-input title-input" placeholder="What do you need to do?" value={title} onChange={(e) => setTitle(e.target.value)} />
      <label className="field-label">A few details <span className="optional">Optional</span></label><textarea className="field-input notes-input" placeholder="Add a note or a tiny reminder…" value={notes} onChange={(e) => setNotes(e.target.value)} rows="2" />
      <div className="form-grid">
        <div><label className="field-label">Date</label><input className="field-input" type="date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} /></div>
        <div><label className="field-label">Priority</label><select className="field-input" value={priority} onChange={(e) => setPriority(e.target.value)}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></div>
        <div><label className="field-label">Start time</label><input className="field-input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
        <div><label className="field-label">End time</label><input className="field-input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
      </div>
      <label className="field-label">Category</label><div className="category-options">{CATEGORIES.map((item) => <button type="button" key={item} onClick={() => setCategory(item)} className={"category-choice tone-" + COLORS[item] + (category === item ? " selected" : "")}><span className="task-dot" />{item}</button>)}</div>
      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions">{initial && <button type="button" className="delete-button" onClick={() => onDelete(initial.id)}><Trash2 size={16} /> Delete</button>}<div className="actions-spacer" /><button type="button" className="btn-quiet" onClick={onClose}>Cancel</button><button type="submit" className="btn-primary"><Check size={16} /> {initial ? "Save changes" : "Add task"}</button></div>
    </form>
  </div>;
}

function AuthModal({ onClose, onSubmit, busy, error }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <form className="auth-modal" onSubmit={(e) => { e.preventDefault(); onSubmit(email, password, mode); }}>
      <div className="auth-mark"><Sparkles size={21} /></div><IconButton label="Close" onClick={onClose} className="auth-close"><X size={18} /></IconButton>
      <span className="eyebrow">YOUR PLANS, EVERYWHERE</span><h2>{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
      <p className="muted-copy">Sign in to sync your tasks securely across your devices.</p>
      <label className="field-label">Email address</label><input className="field-input" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label className="field-label">Password</label><input className="field-input" type="password" minLength="6" required placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="form-error">{error}</p>}
      <button disabled={busy} className="btn-primary auth-submit">{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"} <ArrowRight size={17} /></button>
      <p className="auth-switch">{mode === "signin" ? "New to DayFlow?" : "Already have an account?"} <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "Create an account" : "Sign in"}</button></p>
    </form>
  </div>;
}

function EmptyState({ onAdd }) {
  return <div className="day-empty"><div className="empty-illustration"><CalendarDays size={22} /></div><h3>A day with room to breathe</h3><p>Nothing scheduled here yet. Add a task and give your day a little shape.</p><button className="btn-primary" onClick={onAdd}><Plus size={16} /> Add a task</button></div>;
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [visibleMonth, setVisibleMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [view, setView] = useState("month");
  const [modal, setModal] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [toast, setToast] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    if (!firebaseReady) {
      try { setTasks(JSON.parse(localStorage.getItem("dayflow-tasks") || "[]")); } catch { setTasks([]); }
      return;
    }
    return onAuthStateChanged(auth, (user) => setAuthUser(user));
  }, []);

  useEffect(() => {
    if (!authUser || !firebaseReady) {
      try { setTasks(JSON.parse(localStorage.getItem("dayflow-tasks") || "[]")); } catch { setTasks([]); }
      return;
    }
    return onSnapshot(collection(db, "users", authUser.uid, "tasks"),
      (snapshot) => setTasks(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      () => notify("Couldn't sync tasks. Check your connection."));
  }, [authUser]);

  useEffect(() => {
    if (!authUser) localStorage.setItem("dayflow-tasks", JSON.stringify(tasks));
  }, [tasks, authUser]);

  function notify(message) {
    setToast(message);
    window.clearTimeout(window.__dayflowToast);
    window.__dayflowToast = window.setTimeout(() => setToast(""), 2800);
  }

  const completedCount = tasks.filter((t) => t.completed).length;
  const todayTasks = tasks.filter((t) => t.date === dateKey(today));
  const todayDone = todayTasks.filter((t) => t.completed).length;
  const progress = todayTasks.length ? Math.round(todayDone / todayTasks.length * 100) : 0;
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
    if (modal?.task) {
      if (authUser && firebaseReady) await updateDoc(doc(db, "users", authUser.uid, "tasks", modal.task.id), data);
      else setTasks((items) => items.map((t) => t.id === modal.task.id ? { ...t, ...data } : t));
      notify("Task updated");
    } else {
      const task = { ...data, completed: false, createdAt: new Date().toISOString() };
      if (authUser && firebaseReady) await addDoc(collection(db, "users", authUser.uid, "tasks"), { ...task, createdAt: serverTimestamp() });
      else setTasks((items) => [...items, { ...task, id: makeId() }]);
      notify("Task added to your calendar");
    }
    setModal(null);
  }

  async function removeTask(id) {
    if (authUser && firebaseReady) await deleteDoc(doc(db, "users", authUser.uid, "tasks", id));
    else setTasks((items) => items.filter((t) => t.id !== id));
    setModal(null); notify("Task deleted");
  }

  async function toggleTask(task) {
    const completed = !task.completed;
    if (authUser && firebaseReady) await updateDoc(doc(db, "users", authUser.uid, "tasks", task.id), { completed });
    else setTasks((items) => items.map((t) => t.id === task.id ? { ...t, completed } : t));
  }

  async function authenticate(email, password, mode) {
    setAuthBusy(true); setAuthError("");
    try {
      if (mode === "signup") await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
      setAuthOpen(false); notify("You're signed in — tasks will sync.");
    } catch (e) {
      setAuthError(e.code === "auth/email-already-in-use" ? "That email already has an account. Try signing in." : e.code === "auth/invalid-credential" ? "Email or password doesn't look right." : e.message);
    } finally { setAuthBusy(false); }
  }

  function changeMonth(amount) { setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + amount, 1)); }
  function chooseDate(date) {
    setSelectedDate(date);
    if (date.getMonth() !== visibleMonth.getMonth()) setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }
  function openNewTask(date = selectedDate) { setModal({ date }); }
  function editTask(task) { setModal({ task, date: fromKey(task.date) }); }

  return <div className="app-shell">
    <aside className={"sidebar " + (mobileNav ? "sidebar-open" : "")}>
      <div className="brand"><div className="brand-icon"><Sparkles size={19} strokeWidth={2.4} /></div><span>dayflow<span className="brand-period">.</span></span></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="main-nav">
        <button className="nav-item" onClick={() => { setView("month"); setMobileNav(false); }}><LayoutDashboard size={18} /> Overview</button>
        <button className="nav-item nav-active" onClick={() => { setView("month"); setMobileNav(false); }}><CalendarDays size={18} /> Calendar <span className="nav-count">{tasks.length}</span></button>
        <button className="nav-item" onClick={() => { chooseDate(today); setView("day"); setMobileNav(false); }}><ListTodo size={18} /> My tasks</button>
      </nav>
      <div className="sidebar-divider" />
      <div className="workspace-label category-heading">CATEGORIES <button aria-label="Add task" onClick={() => openNewTask()}><Plus size={15} /></button></div>
      <div className="category-nav">{CATEGORIES.map((c) => <button key={c} onClick={() => { setFilter(filter === c ? "All" : c); setView("month"); setMobileNav(false); }} className={"category-nav-item " + (filter === c ? "category-nav-selected" : "")}><span className={"category-dot " + COLORS[c]} />{c}<span className="category-total">{tasks.filter((t) => t.category === c).length}</span></button>)}</div>
      <div className="sidebar-bottom">
        <div className="sidebar-tip"><div className="tip-icon"><Sparkles size={16} /></div><strong>One thing at a time.</strong><p>Small steps make great days. Keep your focus on what matters.</p></div>
        <div className="profile-row"><div className="avatar">{authUser?.email?.[0]?.toUpperCase() || "D"}</div><div className="profile-copy"><strong>{authUser ? authUser.email.split("@")[0] : "Your workspace"}</strong><span>{authUser ? "Synced account" : "Personal planner"}</span></div><button className="profile-action" onClick={() => authUser ? signOut(auth) : firebaseReady ? setAuthOpen(true) : notify("Add Firebase config to enable cloud sync.")} title={authUser ? "Sign out" : "Sign in"}>{authUser ? <LogOut size={17} /> : <Settings2 size={17} />}</button></div>
      </div>
    </aside>
    {mobileNav && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}

    <main className="main-area">
      <header className="topbar">
        <div className="topbar-left"><IconButton label="Open menu" className="menu-toggle" onClick={() => setMobileNav(!mobileNav)}><Menu size={20} /></IconButton><span className="breadcrumb">Workspace <span>/</span> <b>Calendar</b></span></div>
        <div className="topbar-right"><div className={"sync-status " + (authUser ? "synced" : "")}>{authUser ? <Cloud size={15} /> : <CloudOff size={15} />}<span>{authUser ? "Synced" : "Local mode"}</span></div>
          {authUser ? <button className="top-signin" onClick={() => signOut(auth)}><LogOut size={15} /> Sign out</button> : <button className="top-signin" onClick={() => firebaseReady ? setAuthOpen(true) : notify("Add Firebase config to enable cloud sync.")}><LogIn size={15} /> Sign in</button>}
          <div className="top-avatar">{authUser?.email?.[0]?.toUpperCase() || "D"}</div>
        </div>
      </header>

      <section className="page-content">
        <div className="welcome-row"><div><div className="date-overline"><span className="live-dot" /> {fullDay(today).toUpperCase()}</div><h1>{greeting()}, let's make<br className="mobile-break" /> today <span className="heading-accent">count.</span></h1><p className="welcome-subtitle">A little clarity goes a long way. Here's your plan.</p></div><button className="btn-primary add-main" onClick={() => openNewTask()}><Plus size={18} /> Add a task</button></div>

        <section className="stats-grid">
          <div className="stat-card stat-highlight"><div className="stat-top"><span>Today's progress</span><span className="stat-icon"><Sparkles size={17} /></span></div><div className="stat-main"><strong>{progress}<small>%</small></strong><div className="progress-ring" style={{ "--progress": (progress * 3.6) + "deg" }}><div>{todayDone}<small>/{todayTasks.length}</small></div></div></div><div className="stat-foot">{todayTasks.length ? (todayTasks.length - todayDone) + " tasks left to go" : "A fresh page. Add your first task."}</div></div>
          <div className="stat-card"><div className="stat-top"><span>Tasks this week</span><span className="stat-icon pale-blue"><CalendarDays size={17} /></span></div><div className="stat-number">{tasks.filter((t) => t.date >= dateKey(weekStart) && t.date <= dateKey(addDays(weekStart, 6))).length}</div><div className="stat-foot">Across your calendar</div></div>
          <div className="stat-card"><div className="stat-top"><span>All completed</span><span className="stat-icon pale-green"><CheckCircle2 size={17} /></span></div><div className="stat-number">{completedCount}</div><div className="stat-foot">Little wins add up</div></div>
          <div className="stat-card"><div className="stat-top"><span>Coming up</span><span className="stat-icon pale-amber"><Clock3 size={17} /></span></div><div className="stat-number">{upcoming.length}</div><div className="stat-foot">Your next few priorities</div></div>
        </section>

        <section className="planner-layout">
          <div className="calendar-card">
            <div className="calendar-toolbar"><div><span className="eyebrow">YOUR SCHEDULE</span><h2>{view === "day" ? fullDay(selectedDate) : view === "week" ? "Week of " + selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : monthLabel(visibleMonth)}</h2></div>
              <div className="calendar-actions"><button className="today-button" onClick={() => { chooseDate(today); setView("month"); }}>Today</button><div className="view-switch">{["month", "week", "day"].map((v) => <button key={v} onClick={() => setView(v)} className={view === v ? "view-selected" : ""}>{v[0].toUpperCase() + v.slice(1)}</button>)}</div>
                <div className="month-arrows"><IconButton label="Previous" onClick={() => view === "week" ? chooseDate(addDays(selectedDate, -7)) : view === "day" ? chooseDate(addDays(selectedDate, -1)) : changeMonth(-1)}><ChevronLeft size={17} /></IconButton><IconButton label="Next" onClick={() => view === "week" ? chooseDate(addDays(selectedDate, 7)) : view === "day" ? chooseDate(addDays(selectedDate, 1)) : changeMonth(1)}><ChevronRight size={17} /></IconButton></div>
              </div>
            </div>
            <div className="calendar-legend"><span><i className="legend-dot violet" />Study</span><span><i className="legend-dot blue" />Work</span><span><i className="legend-dot amber" />Personal</span><span><i className="legend-dot green" />Health</span></div>
            {view === "month" && <div className="month-calendar"><div className="weekday-row">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d}>{d}</div>)}</div><div className="month-grid">{monthCells.map((date) => {
              const dayTasks = tasks.filter((t) => t.date === dateKey(date) && (filter === "All" || t.category === filter));
              const inMonth = date.getMonth() === visibleMonth.getMonth();
              return <button key={dateKey(date)} className={"month-cell " + (!inMonth ? "outside-month " : "") + (sameDay(date, selectedDate) ? "selected-cell " : "") + (sameDay(date, today) ? "current-cell" : "")} onClick={() => chooseDate(date)}>
                <span className="cell-date">{date.getDate()}</span><div className="cell-events">{dayTasks.slice(0, 2).map((t) => <TaskPill key={t.id} task={t} onClick={editTask} compact />)}{dayTasks.length > 2 && <span className="more-events">+{dayTasks.length - 2} more</span>}</div>
              </button>;
            })}</div></div>}
            {view === "week" && <div className="week-grid">{weekDates.map((date) => {
              const dayTasks = tasks.filter((t) => t.date === dateKey(date) && (filter === "All" || t.category === filter)).sort((a,b) => (a.startTime || "").localeCompare(b.startTime || ""));
              return <div key={dateKey(date)} className={"week-column " + (sameDay(date,today) ? "week-today" : "")}><button className="week-day-head" onClick={() => chooseDate(date)}><span>{shortDay(date)}</span><b>{date.getDate()}</b></button><div className="week-events">{dayTasks.map((t) => <TaskPill key={t.id} task={t} onClick={editTask} />)}<button className="week-add" onClick={() => { chooseDate(date); openNewTask(date); }}><Plus size={15} /></button></div></div>;
            })}</div>}
            {view === "day" && <div className="day-agenda">{selectedTasks.length ? selectedTasks.map((t) => <div className="day-event" key={t.id}><div className="day-event-time">{t.startTime || "Anytime"}<span>{t.endTime || ""}</span></div><div className={"day-event-bar tone-" + (COLORS[t.category] || "violet")}><div><strong className={t.completed ? "strike" : ""}>{t.title}</strong><span>{t.category} · {t.priority} priority</span></div><div className="day-event-actions"><button onClick={() => toggleTask(t)} aria-label="Toggle task">{t.completed ? <CheckCircle2 size={18} /> : <span className="empty-check" />}</button><button onClick={() => editTask(t)} aria-label="Edit task"><Pencil size={16} /></button></div></div></div>) : <EmptyState onAdd={() => openNewTask(selectedDate)} />}</div>}
            <div className="calendar-footer"><span><span className="footer-dot" /> {tasks.filter((t) => t.date === dateKey(selectedDate)).length} tasks on {sameDay(selectedDate, today) ? "today" : selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span><button onClick={() => setView("day")}>View daily agenda <ArrowRight size={15} /></button></div>
          </div>

          <aside className="agenda-card">
            <div className="agenda-heading"><div><span className="eyebrow">YOUR DAY</span><h2>{sameDay(selectedDate, today) ? "Today's focus" : "Daily focus"}</h2></div><button className="more-button" onClick={() => setView("day")} aria-label="Open day view"><MoreHorizontal size={19} /></button></div>
            <div className="agenda-date"><div className="agenda-date-number">{selectedDate.getDate()}</div><div><strong>{selectedDate.toLocaleDateString("en-US", { weekday: "long" })}</strong><span>{selectedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span></div></div>
            <div className="agenda-progress"><div><span>Daily completion</span><b>{selectedTasks.filter((t) => t.completed).length}/{selectedTasks.length}</b></div><div className="progress-track"><span style={{ width: (selectedTasks.length ? selectedTasks.filter((t) => t.completed).length / selectedTasks.length * 100 : 0) + "%" }} /></div></div>
            <div className="agenda-search"><Search size={14} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a task..." aria-label="Find a task" /></div>
            <div className="agenda-list">{visibleTasks.length ? visibleTasks.map((t) => <div className={"agenda-task " + (t.completed ? "agenda-task-done" : "")} key={t.id}>
              <button className="task-check" onClick={() => toggleTask(t)} aria-label={t.completed ? "Mark incomplete" : "Mark complete"}>{t.completed && <Check size={13} />}</button>
              <button className="agenda-task-main" onClick={() => editTask(t)}><strong>{t.title}</strong><span><Clock3 size={12} /> {t.startTime || "Anytime"}{t.endTime ? " – " + t.endTime : ""}</span></button>
              <span className={"priority-mark priority-" + t.priority.toLowerCase()} title={t.priority}><Flag size={13} /></span>
            </div>) : <div className="agenda-empty"><div className="empty-illustration"><CalendarDays size={21} /></div><strong>Nothing on the list</strong><p>Enjoy a little breathing room or add something you want to get done.</p><button onClick={() => openNewTask(selectedDate)}><Plus size={15} /> Add a task</button></div>}</div>
            <button className="agenda-add" onClick={() => openNewTask(selectedDate)}><Plus size={16} /> Add to this day</button>
            <div className="upcoming-block"><div className="upcoming-title"><span className="eyebrow">UP NEXT</span><button onClick={() => { setSelectedDate(today); setView("week"); }}>See week <ArrowRight size={13} /></button></div>
              {upcoming.length ? upcoming.slice(0, 3).map((t) => <button key={t.id} className="upcoming-item" onClick={() => { chooseDate(fromKey(t.date)); editTask(t); }}><span className={"upcoming-marker " + COLORS[t.category]} /><span className="upcoming-copy"><strong>{t.title}</strong><small>{sameDay(fromKey(t.date), today) ? "Today" : fromKey(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {t.startTime || "Anytime"}</small></span><ChevronRight size={15} /></button>) : <p className="no-upcoming">You're all caught up. Nice work.</p>}
            </div>
          </aside>
        </section>
        <div className="bottom-note"><Sparkles size={14} /><span>Make space for what matters. The rest can wait.</span><span className="note-right">DAYFLOW · YOUR PERSONAL PLANNER</span></div>
      </section>
    </main>

    {modal && <TaskModal initial={modal.task} date={modal.date || selectedDate} onClose={() => setModal(null)} onSave={saveTask} onDelete={removeTask} />}
    {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSubmit={authenticate} busy={authBusy} error={authError} />}
    {toast && <div className="toast"><CheckCircle2 size={17} />{toast}</div>}
  </div>;
}
