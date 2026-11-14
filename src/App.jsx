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
  onAuthStateChanged, updateProfile
} from "firebase/auth";
import { auth, db, storage, firebaseReady, ensurePersonalWorkspace } from "./firebase";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";

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
  const [fullName, setFullName] = useState("");
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <form className="auth-modal" onSubmit={(e) => { e.preventDefault(); onSubmit(email, password, mode, fullName); }}>
      <div className="auth-mark"><Sparkles size={21} /></div><IconButton label="Close" onClick={onClose} className="auth-close"><X size={18} /></IconButton>
      <span className="eyebrow">YOUR PLANS, EVERYWHERE</span><h2>{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
      <p className="muted-copy">Sign in to sync your tasks securely across your devices.</p>
      {mode === "signup" && <><label className="field-label">Your name</label><input className="field-input" type="text" required minLength="2" maxLength="60" placeholder="How should we call you?" value={fullName} onChange={(e) => setFullName(e.target.value)} /></>}
      <label className="field-label">Email address</label><input className="field-input" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label className="field-label">Password</label><input className="field-input" type="password" minLength="6" required placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="form-error">{error}</p>}
      <button disabled={busy} className="btn-primary auth-submit">{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"} <ArrowRight size={17} /></button>
      <p className="auth-switch">{mode === "signin" ? "New to DayFlow?" : "Already have an account?"} <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "Create an account" : "Sign in"}</button></p>
    </form>
  </div>;
}


function OnboardingModal({ name, workspaceName, setName, setWorkspaceName, onSubmit, busy, error }) {
  return <div className="modal-backdrop onboarding-backdrop">
    <form className="onboarding-modal" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <div className="onboarding-art"><div className="onboarding-orbit orbit-one"/><div className="onboarding-orbit orbit-two"/><div className="onboarding-spark"><Sparkles size={25}/></div><span className="onboarding-art-check"><Check size={15}/></span></div>
      <span className="eyebrow">WELCOME TO DAYFLOW</span><h2>Let's make this space yours.</h2>
      <p className="muted-copy">A couple of details help us set up your personal planning space.</p>
      <label className="field-label">What should we call you?</label>
      <input className="field-input" required minLength="2" maxLength="60" placeholder="Your name" value={name} onChange={(e)=>setName(e.target.value)}/>
      <label className="field-label">Name your workspace</label>
      <input className="field-input" required minLength="2" maxLength="60" placeholder="e.g. Personal workspace" value={workspaceName} onChange={(e)=>setWorkspaceName(e.target.value)}/>
      {error && <p className="form-error">{error}</p>}
      <button className="btn-primary onboarding-submit" disabled={busy}>{busy ? "Setting up your space…" : "Create my workspace"} <ArrowRight size={17}/></button>
      <span className="onboarding-foot"><span className="lock-icon">●</span> Your workspace is private to your account.</span>
    </form>
  </div>;
}


function SettingsModal({user,workspace,onClose,onSave,onPhotoUpload,saving,error,theme,setTheme,notifications,setNotifications}) {
 const [name,setName]=useState(user?.displayName||""); const [space,setSpace]=useState(workspace?.name||"Personal workspace");
 const [photoBusy,setPhotoBusy]=useState(false); const [photoError,setPhotoError]=useState("");
 async function photoChange(e){const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith("image/")){setPhotoError("Choose an image file.");return;}if(file.size>3*1024*1024){setPhotoError("Image must be smaller than 3 MB.");return;}setPhotoBusy(true);setPhotoError("");try{await onPhotoUpload(file);}catch{setPhotoError("Upload failed. Check Firebase Storage setup and rules.");}finally{setPhotoBusy(false);e.target.value="";}}
 return <div className="modal-backdrop settings-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form className="settings-modal" onSubmit={e=>{e.preventDefault();onSave(name,space);}}>
 <div className="modal-top"><div><span className="eyebrow">PREFERENCES</span><h2>Settings</h2></div><IconButton label="Close settings" onClick={onClose}><X size={19}/></IconButton></div>
 <section className="settings-section"><h3>Profile</h3><div className="settings-profile"><div className="settings-avatar">{user?.photoURL?<img src={user.photoURL} alt="Profile"/>:(name.trim()[0]||user?.email?.[0]||"D").toUpperCase()}</div><div><label className="settings-upload">{photoBusy?"Uploading…":"Change photo"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={photoChange} disabled={photoBusy}/></label><small>JPG, PNG or WebP · Max 3 MB</small></div></div>{photoError&&<p className="form-error">{photoError}</p>}
 <label className="field-label">Display name</label><input className="field-input" value={name} onChange={e=>setName(e.target.value)} required minLength="2" maxLength="60"/>
 <label className="field-label">Email address</label><input className="field-input" value={user?.email||""} disabled/></section>
 <section className="settings-section"><h3>Workspace</h3><label className="field-label">Workspace name</label><input className="field-input" value={space} onChange={e=>setSpace(e.target.value)} required minLength="2" maxLength="60"/></section>
 <section className="settings-section"><h3>Appearance</h3><div className="settings-choice-row"><div><b>Color theme</b><small>Choose how DayFlow looks on this device.</small></div><select className="field-input settings-select" value={theme} onChange={e=>setTheme(e.target.value)}><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></div></section>
 <section className="settings-section"><h3>Notifications</h3><label className="settings-toggle"><span><b>Task reminders</b><small>Allow DayFlow to show reminder prompts.</small></span><input type="checkbox" checked={notifications} onChange={e=>setNotifications(e.target.checked)}/></label></section>
 {error&&<p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="btn-quiet" onClick={onClose}>Cancel</button><div className="actions-spacer"/><button className="btn-primary" disabled={saving}>{saving?"Saving…":"Save settings"} <Check size={16}/></button></div>
 </form></div>;
}

function EmptyState({ onAdd }) {
  return <div className="day-empty"><div className="empty-illustration"><CalendarDays size={22} /></div><h3>A day with room to breathe</h3><p>Nothing scheduled here yet. Add a task and give your day a little shape.</p><button className="btn-primary" onClick={onAdd}><Plus size={16} /> Add a task</button></div>;
}


function MarketingPage({ onStart, onSignIn, onDemo }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="marketing-shell">
    <header className="marketing-nav">
      <a className="marketing-brand" href="#home" aria-label="DayFlow home"><span className="marketing-brand-icon"><Sparkles size={19} /></span>dayflow<span>.</span></a>
      <button className="marketing-menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation"><Menu size={20} /></button>
      <nav className={menuOpen ? "marketing-links marketing-links-open" : "marketing-links"}>
        <a href="#features" onClick={() => setMenuOpen(false)}>Features</a><a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a><a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a>
      </nav>
      <div className="marketing-nav-actions"><button className="marketing-login" onClick={onSignIn}>Log in</button><button className="marketing-nav-cta" onClick={onStart}>Get started <ArrowRight size={15} /></button></div>
    </header>
    <main id="home">
      <section className="marketing-hero">
        <div className="hero-copy">
          <div className="hero-badge"><span /> A calmer way to get things done</div>
          <h1>Make room for<br />what <span>matters.</span></h1>
          <p className="hero-description">Your plans, tasks and goals in one clear space. DayFlow helps you turn busy days into days that feel a little more in control.</p>
          <div className="hero-actions"><button className="hero-primary" onClick={onStart}>Start planning for free <ArrowRight size={17} /></button><button className="hero-secondary" onClick={onDemo}><span className="demo-play">▶</span> Explore the planner</button></div>
          <div className="hero-trust"><div className="trust-avatars"><span>J</span><span>A</span><span>M</span><span>+</span></div><span>One thoughtful plan at a time.</span></div>
        </div>
        <div className="hero-visual" aria-label="Preview of the DayFlow calendar">
          <div className="visual-glow" />
          <div className="preview-window">
            <div className="preview-top"><div className="preview-dots"><i/><i/><i/></div><span>PERSONAL WORKSPACE</span><span className="preview-user">D</span></div>
            <div className="preview-content">
              <div className="preview-sidebar"><div className="preview-logo"><Sparkles size={14}/> dayflow.</div><div className="preview-nav-active"><CalendarDays size={13}/> Calendar</div><div><ListTodo size={13}/> My tasks</div><div><Flag size={13}/> Goals</div><div className="preview-side-label">CATEGORIES</div><div><i className="preview-dot dot-purple"/> Study</div><div><i className="preview-dot dot-blue"/> Work</div><div><i className="preview-dot dot-orange"/> Personal</div></div>
              <div className="preview-main"><div className="preview-greeting">YOUR WEEK AT A GLANCE</div><div className="preview-heading">A little progress, every day.</div><div className="preview-stats"><div><small>Tasks planned</small><b>12</b></div><div><small>Completed</small><b>08</b></div><div><small>Focus score</small><b>84%</b></div></div><div className="preview-calendar"><div className="preview-month"><b>November 2026</b><span>‹　›</span></div><div className="preview-days">{["MON","TUE","WED","THU","FRI","SAT","SUN"].map((d,i)=><div key={d}><small>{d}</small><b className={i===2?"preview-today":""}>{9+i}</b>{i===0||i===2||i===3||i===5?<i/>:null}</div>)}</div><div className="preview-events"><div className="preview-event event-purple">Study · 9:00</div><div className="preview-event event-blue">Project work · 11:30</div><div className="preview-event event-orange">Personal · 16:00</div></div></div></div>
            </div>
          </div>
          <div className="floating-note"><span><Check size={14}/></span><div><b>Small win unlocked</b><small>One task at a time.</small></div></div>
        </div>
      </section>
      <div className="marketing-strip"><span>LESS CLUTTER</span><i/><span>MORE CLARITY</span><i/><span>YOUR OWN PACE</span><i/><span>ROOM TO GROW</span></div>
      <section className="marketing-section" id="features"><div className="section-intro"><span className="marketing-kicker">A BETTER WAY TO PLAN</span><h2>Everything in its<br/><span>right place.</span></h2><p>Simple tools that work together, so you can spend less time organizing and more time doing.</p></div>
        <div className="feature-grid"><article className="feature-card feature-large"><div className="feature-icon feature-lilac"><CalendarDays size={21}/></div><h3>Your calendar, your way</h3><p>See your month, week or day. Add tasks with dates, times and priorities, then move through your schedule with ease.</p><div className="mini-week"><span>MON <b>09</b></span><span className="mini-week-active">TUE <b>10</b></span><span>WED <b>11</b></span><span>THU <b>12</b></span><span>FRI <b>13</b></span></div></article>
          <article className="feature-card"><div className="feature-icon feature-blue"><Cloud size={21}/></div><h3>Your plans stay with you</h3><p>Sign in to securely sync your personal tasks across devices with Firebase.</p><div className="feature-sync"><Cloud size={17}/> Synced to your workspace <CheckCircle2 size={16}/></div></article>
          <article className="feature-card"><div className="feature-icon feature-peach"><Sparkles size={21}/></div><h3>Progress you can feel</h3><p>Keep an eye on daily completion and upcoming priorities without a crowded dashboard.</p><div className="feature-progress"><span><b/></span><strong>68%</strong></div></article>
        </div>
      </section>
      <section className="how-section" id="how-it-works"><div className="how-heading"><span className="marketing-kicker">START SMALL. BUILD MOMENTUM.</span><h2>A plan that feels<br/><span>like yours.</span></h2></div><div className="how-steps"><article><b>01</b><h3>Make your space</h3><p>Create your account and get a personal workspace of your own.</p></article><article><b>02</b><h3>Put it on the calendar</h3><p>Add what matters, choose a time and keep priorities clear.</p></article><article><b>03</b><h3>Find your flow</h3><p>Check things off, see your progress and adjust as life happens.</p></article></div></section>
      <section className="pricing-section" id="pricing"><div><span className="marketing-kicker">SIMPLE TO START</span><h2>Good planning<br/><span>starts here.</span></h2><p>Start with the essentials. DayFlow is being built to grow with the way you work.</p></div><div className="pricing-card"><span className="pricing-label">PERSONAL</span><div className="pricing-price">Free <small>to get started</small></div><p>Everything you need to bring a little clarity to your day.</p><ul><li><Check size={15}/> Personal workspace</li><li><Check size={15}/> Month, week and day calendar</li><li><Check size={15}/> Tasks, notes and priorities</li><li><Check size={15}/> Secure cloud sync</li></ul><button onClick={onStart}>Create your free account <ArrowRight size={16}/></button><small className="pricing-foot">Paid plans and team features are planned for a future release.</small></div></section>
      <section className="final-cta"><div><span className="marketing-kicker">YOUR NEXT CHAPTER, ONE TASK AT A TIME</span><h2>Make today<br/>feel a little lighter.</h2></div><button onClick={onStart}>Get started with DayFlow <ArrowRight size={17}/></button></section>
    </main>
    <footer className="marketing-footer"><a className="marketing-brand" href="#home"><span className="marketing-brand-icon"><Sparkles size={17}/></span>dayflow<span>.</span></a><span>Thoughtful planning for real life.</span><span>© 2026 DayFlow</span></footer>
  </div>;
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
  const [toast, setToast] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("Personal workspace");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [settingsBusy,setSettingsBusy]=useState(false);
  const [settingsError,setSettingsError]=useState("");
  const [theme,setTheme]=useState(()=>localStorage.getItem("dayflow-theme")||"light");
  const [notifications,setNotifications]=useState(()=>localStorage.getItem("dayflow-notifications")!=="off");

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
        setWorkspaceError("Your account is signed in, but workspace setup needs attention.");
      }
    });
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

  useEffect(()=>{localStorage.setItem("dayflow-theme",theme);},[theme]);
  useEffect(()=>{localStorage.setItem("dayflow-notifications",notifications?"on":"off");},[notifications]);

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

  async function authenticate(email, password, mode, fullName = "") {
    setAuthBusy(true); setAuthError("");
    try {
      if (mode === "signup") {
        localStorage.setItem("dayflow-onboarding-pending", "1");
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        if (fullName.trim()) await updateProfile(credential.user, { displayName: fullName.trim() });
      } else await signInWithEmailAndPassword(auth, email, password);
      setAuthOpen(false); notify("You're signed in — tasks will sync.");
    } catch (e) {
      localStorage.removeItem("dayflow-onboarding-pending");
      setAuthError(e.code === "auth/email-already-in-use" ? "That email already has an account. Try signing in." : e.code === "auth/invalid-credential" ? "Email or password doesn't look right." : e.message);
    } finally { setAuthBusy(false); }
  }


  async function completeOnboarding() {
    const cleanName = profileName.trim();
    const cleanWorkspace = workspaceName.trim();
    if (cleanName.length < 2 || cleanWorkspace.length < 2) {
      setProfileError("Please enter a name and a workspace name (at least 2 characters).");
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
      notify("Your personal workspace is ready.");
    } catch (error) {
      console.error("Profile setup failed:", error);
      setProfileError("We couldn't save your profile. Please try again.");
    } finally { setProfileBusy(false); }
  }


  async function saveSettings(name,space){
    if(!authUser||!firebaseReady)return;
    if(name.trim().length<2||space.trim().length<2){setSettingsError("Enter a display name and workspace name.");return;}
    setSettingsBusy(true);setSettingsError("");
    try{await updateProfile(authUser,{displayName:name.trim()});await updateDoc(doc(db,"users",authUser.uid),{displayName:name.trim(),updatedAt:serverTimestamp()});await updateDoc(doc(db,"workspaces",authUser.uid),{name:space.trim(),updatedAt:serverTimestamp()});setAuthUser(auth.currentUser);setWorkspace(cur=>({...cur,name:space.trim()}));setSettingsOpen(false);notify("Settings saved.");}
    catch(e){console.error("Settings save failed",e);setSettingsError("Couldn't save settings. Please try again.");}finally{setSettingsBusy(false);}
  }
  async function uploadProfilePhoto(file){
    if(!authUser||!storage)throw new Error("Storage unavailable");
    const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"-").slice(-80);
    const target=storageRef(storage,"profilePhotos/"+authUser.uid+"/"+Date.now()+"-"+safeName);
    await uploadBytes(target,file,{contentType:file.type});const photoURL=await getDownloadURL(target);
    await updateProfile(authUser,{photoURL});await updateDoc(doc(db,"users",authUser.uid),{photoURL,updatedAt:serverTimestamp()});setAuthUser(auth.currentUser);notify("Profile photo updated.");
  }

  function changeMonth(amount) { setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + amount, 1)); }
  function chooseDate(date) {
    setSelectedDate(date);
    if (date.getMonth() !== visibleMonth.getMonth()) setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }
  function openNewTask(date = selectedDate) { setModal({ date }); }
  function editTask(task) { setModal({ task, date: fromKey(task.date) }); }

  if (!authUser && !showDashboard) return <><MarketingPage onStart={() => { if (firebaseReady) setAuthOpen(true); else setShowDashboard(true); }} onSignIn={() => { if (firebaseReady) setAuthOpen(true); else setShowDashboard(true); }} onDemo={() => setShowDashboard(true)} />{authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSubmit={authenticate} busy={authBusy} error={authError} />}{onboardingOpen && authUser && <OnboardingModal name={profileName} workspaceName={workspaceName} setName={setProfileName} setWorkspaceName={setWorkspaceName} onSubmit={completeOnboarding} busy={profileBusy} error={profileError} />}{toast && <div className="toast"><CheckCircle2 size={17}/>{toast}</div>}</>;

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
        <div className="profile-row"><div className="avatar">{authUser?.photoURL?<img src={authUser.photoURL} alt=""/>:authUser?.displayName?.trim()?.[0]?.toUpperCase() || authUser?.email?.[0]?.toUpperCase() || "D"}</div><div className="profile-copy"><strong>{authUser ? (authUser.displayName || authUser.email.split("@")[0]) : "Your workspace"}</strong><span>{workspace?.plan === "free" ? "Free plan · Personal" : authUser ? "Personal workspace" : "Personal planner"}</span></div><button className="profile-action" onClick={() => authUser ? setSettingsOpen(true) : firebaseReady ? setAuthOpen(true) : notify("Add Firebase config to enable cloud sync.")} title={authUser ? "Settings" : "Sign in"}>{authUser ? <Settings2 size={17} /> : <LogIn size={17} />}</button></div>
      </div>
    </aside>
    {mobileNav && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}

    <main className="main-area">
      <header className="topbar">
        <div className="topbar-left"><IconButton label="Open menu" className="menu-toggle" onClick={() => setMobileNav(!mobileNav)}><Menu size={20} /></IconButton><span className="breadcrumb">{workspace?.name || "Personal workspace"} <span>/</span> <b>Calendar</b></span></div>
        <div className="topbar-right">{workspaceError && <span className="workspace-warning" title={workspaceError}>Workspace setup issue</span>}<div className={"sync-status " + (authUser ? "synced" : "")}>{authUser ? <Cloud size={15} /> : <CloudOff size={15} />}<span>{authUser ? "Synced" : "Local mode"}</span></div>
          {authUser ? <button className="top-signin" onClick={() => signOut(auth)}><LogOut size={15} /> Sign out</button> : <button className="top-signin" onClick={() => firebaseReady ? setAuthOpen(true) : notify("Add Firebase config to enable cloud sync.")}><LogIn size={15} /> Sign in</button>}
          <button className="top-avatar top-avatar-button" onClick={()=>authUser&&setSettingsOpen(true)} aria-label="Open settings">{authUser?.photoURL?<img src={authUser.photoURL} alt=""/>:authUser?.displayName?.trim()?.[0]?.toUpperCase() || authUser?.email?.[0]?.toUpperCase() || "D"}</button>
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
    {settingsOpen && authUser && <SettingsModal user={authUser} workspace={workspace} onClose={()=>setSettingsOpen(false)} onSave={saveSettings} onPhotoUpload={uploadProfilePhoto} saving={settingsBusy} error={settingsError} theme={theme} setTheme={setTheme} notifications={notifications} setNotifications={setNotifications}/>}
    {toast && <div className="toast"><CheckCircle2 size={17} />{toast}</div>}
  </div>;
}
