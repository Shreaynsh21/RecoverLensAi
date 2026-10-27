import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import type { ConnectResult, PatientConnection, PrescriptionRequest } from "./CareContext"
import {
  getPatientExercisePlan,
  getPatientProfile,
  getPatientProgress,
  getPatientSessions,
  type ExercisePlan,
  type PatientProfile,
  type PatientProgress,
  type PatientSession,
} from "./api"
import "./patient-dashboard.css"

type PatientDashboardProps = {
  onLogout?: () => void
  patientId: string
  patientName: string
  patientEmail: string
  connectedClinician?: PatientConnection
  onConnectClinician?: (code: string) => ConnectResult
  onPrescriptionSubmitted?: (request: Omit<PrescriptionRequest, "status" | "review">) => void
}

type PatientDashboardData = {
  profile: PatientProfile | null
  plan: ExercisePlan | null
  sessions: PatientSession[]
  progress: PatientProgress | null
  loading: boolean
  error: string | null
}

const emptyPatientData: PatientDashboardData = {
  profile: null,
  plan: null,
  sessions: [],
  progress: null,
  loading: true,
  error: null,
}

function formatSessionDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date)
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60)
  const remainingSeconds = Math.max(0, seconds) % 60
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`
}

type Page =
  | "dashboard"
  | "assessment"
  | "processing"
  | "results"
  | "exercises"
  | "exercise"
  | "live"
  | "summary"
  | "progress"
  | "insights"
  | "clinical"
  | "profile"
  | "settings"
  | "notifications"

const icons: Record<string, string> = {
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  spark: "M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8zM18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z",
  move: "M7 4h10M12 4v5m-5 2-3 3 3 3m10-6 3 3-3 3M9 21l3-6 3 6",
  chart: "M4 19V9m5 10V5m5 14v-7m5 7V3",
  clinical: "M12 21s7-4.3 7-11a4 4 0 0 0-7-2.6A4 4 0 0 0 5 10c0 6.7 7 11 7 11zM9 12h6m-3-3v6",
  user: "M20 21a8 8 0 0 0-16 0m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 13h4",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  back: "M19 12H5m5-5-5 5 5 5",
  play: "M9 7l8 5-8 5z",
  upload: "M12 16V4m-5 5 5-5 5 5M5 20h14",
  camera: "M4 7h3l2-2h6l2 2h3v12H4zM12 11a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4",
  link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-3 3M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l3-3",
  check: "M5 12l4 4L19 6",
  clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  shield: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11zm-3-11 2 2 4-5",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21h-4v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1z",
}

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icons[name]} /></svg>
}

const exercises = [
  { name: "Wall-assisted shoulder flexion", area: "Shoulder mobility", sets: 3, reps: 10, duration: "6 min", level: "Gentle", tone: "blue", videoUrl: "https://videos.sproutvideo.com/embed/1c9adfb1181ee0cd94/5fbd84d468f891cd", videoPage: "https://www.csp.org.uk/conditions/shoulder-pain/video-exercises-shoulder-pain", videoSource: "Chartered Society of Physiotherapy", instructions: "Stand facing a wall. Walk your fingers upward only as far as comfortable, then return slowly." },
  { name: "Scapular retraction", area: "Upper back control", sets: 3, reps: 12, duration: "5 min", level: "Moderate", tone: "green", videoUrl: "https://www.youtube-nocookie.com/embed/Kn9mAgIhBW0", videoPage: "https://www.youtube.com/watch?v=Kn9mAgIhBW0", videoSource: "KAIST Sports Complex", instructions: "Sit or stand tall, gently draw the shoulder blades inward and slightly down, hold briefly, then relax." },
  { name: "Isometric external rotation", area: "Rotator cuff strength", sets: 2, reps: 8, duration: "4 min", level: "Gentle", tone: "violet", videoUrl: "https://www.youtube-nocookie.com/embed/kWtMKNnjyd0", videoPage: "https://www.youtube.com/watch?v=kWtMKNnjyd0", videoSource: "Hope Physical Therapy and Aquatics", instructions: "Keep the elbow tucked at 90 degrees and gently press outward against a wall without moving the arm." },
]

const nav = [
  ["dashboard", "grid", "Dashboard"],
  ["assessment", "spark", "AI Recovery"],
  ["exercises", "move", "Exercises"],
  ["progress", "chart", "Progress"],
  ["clinical", "clinical", "Clinical Care"],
  ["profile", "user", "Profile"],
]

function Button({ children, onClick, variant = "primary", disabled = false }: { children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger"; disabled?: boolean }) {
  return <button className={`btn ${variant}`} onClick={onClick} disabled={disabled}>{children}</button>
}

function Tag({ children, green = false }: { children: ReactNode; green?: boolean }) {
  return <span className={`tag ${green ? "green" : ""}`}>{children}</span>
}

function MiniChart({ bars = false }: { bars?: boolean }) {
  if (bars) return <div className="bar-chart">{[48, 70, 42, 88, 65, 96, 76].map((h, i) => <div key={i} className={i === 5 ? "active" : ""} style={{ height: `${h}%` }}><span>{["M","T","W","T","F","S","S"][i]}</span></div>)}</div>
  return <div className="line-chart"><svg viewBox="0 0 500 150" preserveAspectRatio="none"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#25C995" stopOpacity=".32"/><stop offset="1" stopColor="#25C995" stopOpacity="0"/></linearGradient></defs><path className="area" d="M0 125 C50 110 65 120 110 88 S180 110 220 72 S290 80 330 48 S410 62 500 20 L500 150 L0 150Z"/><path className="line" d="M0 125 C50 110 65 120 110 88 S180 110 220 72 S290 80 330 48 S410 62 500 20"/><circle cx="500" cy="20" r="6"/></svg><div className="chart-labels"><span>W1</span><span>W2</span><span>W3</span><span>W4</span><span>Today</span></div></div>
}

function Orbit({ data }: { data: PatientDashboardData }) {
  const progress = data.progress
  const totalSessions = progress?.total_sessions ?? 0
  const totalRepetitions = progress?.total_repetitions ?? 0
  return <div className="orbit-wrap">
    <div className="orbit">
      <svg viewBox="0 0 220 220"><circle className="orbit-base" cx="110" cy="110" r="92"/><circle className="orbit-fill" cx="110" cy="110" r="92"/><circle className="orbit-inner" cx="110" cy="110" r="74"/></svg>
      <div className="orbit-center"><b>{data.loading ? "…" : totalSessions}</b><span>saved sessions</span></div>
      <i className="node n1"/><i className="node n2"/><i className="node n3"/>
    </div>
    <div className="orbit-meta"><Tag green={totalSessions > 0}>{totalSessions > 0 ? "Recorded activity" : "Awaiting first session"}</Tag><p>{totalRepetitions} repetitions recorded</p><small>Based on saved backend records, not an AI recovery score</small></div>
  </div>
}

function PageHead({ title, eyebrow, back, action }: { title: string; eyebrow: string; back?: () => void; action?: ReactNode }) {
  return <header className="page-head"><div>{back && <button className="icon-btn back" onClick={back}><Icon name="back"/></button>}<div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1></div></div>{action}</header>
}

function Dashboard({ go, patientName, data }: { go: (p: Page) => void; patientName: string; data: PatientDashboardData }) {
  const [comfort, setComfort] = useState("Steady")
  const progress = data.progress
  const goodTrackingPercent = progress && progress.total_sessions > 0
    ? Math.round((progress.good_tracking_sessions / progress.total_sessions) * 100)
    : null
  const latestAngle = progress?.latest_max_angle
  const recentSessions = data.sessions.slice(0, 3)

  return <div>
    <PageHead eyebrow="YOUR RECOVERY SPACE" title={`Welcome, ${(data.profile?.display_name || patientName).split(" ")[0]}.`} action={<Button variant="secondary" onClick={() => go("clinical")}><Icon name="clinical"/> Clinical care</Button>} />
    <p className="intro">Your dashboard shows the exercise plan and activity saved to your RecoverLens account. Follow your clinician’s instructions and stop if movement causes new or worsening pain.</p>
    <section className="daily-checkin" aria-label="Daily comfort check-in">
      <div className="checkin-intro"><span className="pulse-mark"><i/><i/></span><div><span className="eyebrow">DAILY CHECK-IN</span><b>How does movement feel right now?</b></div></div>
      <div className="feeling-options">
        {[ ["Comfortable", "Easy range today"], ["Steady", "A little aware"], ["Sensitive", "Take it gently"] ].map(([label, hint]) => <button key={label} className={comfort === label ? "active" : ""} onClick={() => setComfort(label)} aria-pressed={comfort === label}><i/><span><b>{label}</b><small>{hint}</small></span></button>)}
      </div>
      <span className="checkin-note">{comfort === "Sensitive" ? "Keep movement gentle and follow your clinician’s guidance." : comfort === "Comfortable" ? "Stay within a pain-free range." : "Use the plan assigned by your clinician, if one is available."}</span>
    </section>
    <section className="hero-grid">
      <div className="card orbit-card"><div className="card-label"><Icon name="target"/> Saved activity</div><Orbit data={data}/></div>
      <div className="today-card">
        <div><Tag green={!!data.plan}>{data.plan ? "ACTIVE CLINICIAN PLAN" : "PLAN STATUS"}</Tag><h2>{data.loading ? "Loading your plan…" : data.plan?.name || "Awaiting clinician plan"}</h2><p>{data.plan ? `${data.plan.target_repetitions} target repetitions · ${data.plan.sessions_per_day} session(s) per day` : "Your assigned exercise plan will appear here after a clinician creates it."}</p></div>
        <div className="today-visual"><div className="figure"><span/><span/><span/><span/><span/></div><div className="arc"/></div>
        <Button onClick={() => go("exercises")}><Icon name="play"/> View exercise plan</Button>
      </div>
    </section>
    <section className="mode-grid">
      <button className="mode ai" onClick={() => go("assessment")}><span className="mode-number">01</span><div className="mode-icon"><Icon name="spark" size={24}/></div><div><small>SELF-GUIDED</small><h3>AI Recovery</h3><p>Prototype concept only; it does not generate a clinically approved plan.</p></div><span className="circle-arrow"><Icon name="arrow"/></span></button>
      <button className="mode clinical" onClick={() => go("clinical")}><span className="mode-number">02</span><div className="mode-icon"><Icon name="clinical" size={24}/></div><div><small>PHYSIOTHERAPIST-LED</small><h3>Clinical Care</h3><p>View your account identity and the plan assigned by your clinical team.</p></div><span className="circle-arrow"><Icon name="arrow"/></span></button>
    </section>
    <section className="dashboard-lower">
      <div className="card activity"><div className="card-title"><div><span className="eyebrow">SAVED ACTIVITY</span><h3>Your recorded sessions</h3></div><strong>{data.loading ? "—" : progress?.total_sessions ?? 0} <small>sessions</small></strong></div><div className="metric-row"><div><b>{data.loading ? "—" : Math.round((progress?.total_duration_sec ?? 0) / 60)}</b><span>Minutes recorded</span></div><div><b>{data.loading ? "—" : progress?.total_repetitions ?? 0}</b><span>Repetitions recorded</span></div><div><b>{data.loading ? "—" : goodTrackingPercent === null ? "—" : `${goodTrackingPercent}%`}</b><span>Good tracking</span></div></div><small className="muted">These values come from saved API records. Movement tracking is not simulated.</small></div>
      <div className="card"><div className="card-title"><div><span className="eyebrow">LATEST MEASUREMENT</span><h3>Movement range</h3></div><span className="milestone-icon"><Icon name="target"/></span></div>{latestAngle !== null && latestAngle !== undefined ? <><p className="muted">Latest recorded maximum angle from a good-tracking session.</p><div className="progress-label"><b>{latestAngle.toFixed(1)}°</b><span>{progress?.max_angle_change == null ? "No comparison yet" : `${progress.max_angle_change > 0 ? "+" : ""}${progress.max_angle_change.toFixed(1)}° vs previous`}</span></div></> : <p className="muted">No reliable angle measurement is available yet. Values appear only when a saved session contains angle measurements rated with good tracking quality.</p>}<Button variant="ghost" onClick={() => go("progress")}>View progress <Icon name="arrow"/></Button></div>
    </section>
    <section className="recent"><div className="section-head"><div><span className="eyebrow">HISTORY</span><h2>Recent sessions</h2></div><button onClick={() => go("progress")}>View progress <Icon name="arrow"/></button></div>
      {data.loading ? <p role="status">Loading saved sessions…</p> : recentSessions.length ? recentSessions.map(session => <div className="session-row" key={session.id}><div className="session-date"><b>{new Date(session.started_at).getDate()}</b><span>{new Date(session.started_at).toLocaleDateString("en-IN", { month: "short" }).toUpperCase()}</span></div><div className="session-play"><Icon name="play"/></div><div><b>{data.plan?.name || `Exercise session #${session.exercise_id}`}</b><span>{formatDuration(session.duration_sec)} · {session.repetition_count} repetitions · {formatSessionDate(session.started_at)}</span></div><Tag green={session.tracking_quality === "good"}>{session.tracking_quality} tracking</Tag><span className="submitted">{session.completion_status}</span></div>) : <div className="card"><p>No backend sessions have been saved yet. Once real movement measurements are available and saved, they’ll appear here.</p></div>}
    </section>
  </div>
}

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike
  webkitSpeechRecognition?: new () => SpeechRecognitionLike
}

function Assessment({ go, onPrescriptionSubmitted }: { go: (p: Page) => void; onPrescriptionSubmitted?: (request: Omit<PrescriptionRequest, "status" | "review">) => void }) {
  const [file, setFile] = useState("")
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [symptoms, setSymptoms] = useState("")
  const [listening, setListening] = useState(false)
  const [voiceMessage, setVoiceMessage] = useState("")
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  useEffect(() => () => { recognitionRef.current?.stop() }, [])
  const toggleVoiceInput = () => {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return }
    const speechWindow = window as SpeechRecognitionWindow
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!Recognition) {
      setVoiceMessage("Voice typing is not supported by this browser. Try Chrome or type your symptoms below.")
      return
    }
    try {
      const recognition = new Recognition()
      recognition.lang = "en-IN"
      recognition.interimResults = false
      recognition.continuous = false
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results).map(result => result[0]?.transcript || "").join(" ").trim()
        if (transcript) setSymptoms(current => `${current.trim()}${current.trim() ? " " : ""}${transcript}`.slice(0, 500))
        setVoiceMessage(transcript ? "Voice note converted to text." : "No speech was detected. Please try again.")
      }
      recognition.onerror = (event) => {
        setVoiceMessage(event.error === "not-allowed" ? "Microphone permission was denied. Allow microphone access in your browser settings." : "Could not capture speech. Please try again or type your symptoms.")
        setListening(false)
      }
      recognition.onend = () => setListening(false)
      recognitionRef.current = recognition
      setVoiceMessage("Listening… speak clearly, then pause to finish.")
      setListening(true)
      recognition.start()
    } catch {
      setListening(false)
      setVoiceMessage("Could not start microphone input. Please type your symptoms instead.")
    }
  }
  return <div className="narrow">
    <PageHead eyebrow="AI RECOVERY · STEP 1 OF 2" title="Help us understand your recovery" back={() => go("dashboard")} />
    <p className="intro">Share as much as you’re comfortable with. This prototype uses approved demo pathways and does not provide a medical diagnosis.</p>
    <div className="assessment-grid">
      <div className="card form-card"><h3>Upload a prescription</h3><p className="muted">PDF, PNG or JPG · up to 10 MB</p><label className={`dropzone ${file ? "has-file" : ""}`}><input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => { const selected = e.target.files?.[0] || null; setUploadedFile(selected); setFile(selected?.name || "") }}/><div className="upload-icon"><Icon name={file ? "check" : "upload"}/></div><b>{file || "Drop a file here, or browse"}</b><span>{file ? "Ready for simulated review" : "Your document stays private in this demo"}</span></label>
        <div className="or"><span/>or<span/></div><label className="field"><span className="symptom-label-row"><span>Describe your symptoms</span><button type="button" className={`voice-input-button ${listening ? "listening" : ""}`} onClick={toggleVoiceInput} aria-pressed={listening}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-4 0h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>{listening ? "Listening…" : "Describe by voice"}</button></span><textarea value={symptoms} maxLength={500} onChange={e => setSymptoms(e.target.value)} rows={5} placeholder="Describe the pain, stiffness, location, or what movements are difficult…"/><small>{symptoms.length}/500</small></label>{voiceMessage && <p className={`voice-input-message ${listening ? "listening" : ""}`} role="status">{voiceMessage}</p>}
      </div>
      <div className="card form-card"><h3>Recovery details</h3><div className="fields"><label className="field"><span>Affected area</span><select defaultValue="shoulder"><option value="shoulder">Right shoulder</option><option>Left shoulder</option><option>Knee</option><option>Lower back</option></select></label><label className="field"><span>Discomfort level</span><div className="pain-scale">{[0,1,2,3,4,5,6,7,8,9,10].map(n => <button className={n === 4 ? "selected" : ""} key={n}>{n}</button>)}</div></label><label className="field"><span>When did it begin?</span><select defaultValue="weeks"><option value="weeks">2–4 weeks ago</option><option>Less than a week ago</option><option>1–3 months ago</option></select></label><label className="field"><span>Relevant medical history <em>Optional</em></span><input placeholder="Previous injuries, conditions, or surgery"/></label></div></div>
    </div>
    <div className="notice"><Icon name="shield"/><div><b>Prototype safety note</b><span>Plans use pre-approved demo content. Stop if pain increases and consult a qualified clinician.</span></div></div>
    <div className="form-actions"><Button variant="ghost" onClick={() => go("dashboard")}>Cancel</Button><Button onClick={() => { onPrescriptionSubmitted?.({ name: uploadedFile?.name || "Symptom description", size: uploadedFile?.size || 0, url: uploadedFile ? URL.createObjectURL(uploadedFile) : "#", notes: symptoms }); go("processing") }}>Generate demo assessment <Icon name="arrow"/></Button></div>
  </div>
}

function Processing({ go }: { go: (p: Page) => void }) {
  useEffect(() => { const id = setTimeout(() => go("results"), 2600); return () => clearTimeout(id) }, [go])
  return <div className="processing"><div className="scan-orb"><Icon name="spark" size={34}/><i/><i/><i/></div><Tag>SIMULATED ANALYSIS</Tag><h1>Building your recovery pathway</h1><p>Matching your inputs to approved shoulder mobility demo protocols.</p><div className="steps"><span className="done"><Icon name="check"/> Reviewing symptoms</span><span className="active"><i/> Matching safe movements</span><span><i/> Preparing your plan</span></div><Button variant="ghost" onClick={() => go("assessment")}>Cancel</Button></div>
}

function Results({ go }: { go: (p: Page) => void }) {
  return <div className="narrow"><PageHead eyebrow="AI RECOVERY · DEMO RESULT" title="Your recovery pathway is ready" back={() => go("assessment")} action={<Tag green><Icon name="check"/> Demo plan ready</Tag>}/>
    <div className="result-hero"><div><span className="eyebrow">MOVEMENT FOCUS</span><h2>Restore comfortable<br/>overhead mobility</h2><p>Based on your demo inputs, we’ve selected a gentle 3-week progression focused on range, control, and rotator cuff stability.</p><Button onClick={() => go("exercises")}>View exercise plan <Icon name="arrow"/></Button></div><div className="result-score"><div className="score-ring"><b>Low</b><span>demo risk profile</span></div><small>Not a clinical diagnosis</small></div></div>
    <div className="result-grid"><div className="card"><Icon name="clock"/><b>18 min / day</b><span>4 sessions weekly</span></div><div className="card"><Icon name="move"/><b>3 movements</b><span>Gentle progression</span></div><div className="card"><Icon name="target"/><b>150° goal</b><span>Overhead flexion</span></div></div>
    <div className="card rationale"><div><span className="eyebrow">WHY THIS PATHWAY</span><h3>Designed around control before load</h3></div><ul><li><Icon name="check"/> Starts below your reported pain threshold</li><li><Icon name="check"/> Prioritises scapular movement quality</li><li><Icon name="check"/> Progresses only when movement stays comfortable</li></ul></div>
  </div>
}

function Exercises({ go, data }: { go: (p: Page) => void; data: PatientDashboardData }) {
  const plan = data.plan
  return <div>
    <PageHead eyebrow="CLINICIAN-ASSIGNED CARE" title={plan?.name || "Exercise plan"} action={<Tag green={!!plan}>{plan ? "Plan active" : "Awaiting plan"}</Tag>} />
    {data.loading ? <div className="notice" role="status"><Icon name="clock"/><div><b>Loading your assigned plan</b><span>Checking the plan saved for your account.</span></div></div> : plan ? <>
      <p className="intro">This is the active plan returned by the backend. Follow the instructions provided by your clinician and ask them before changing repetitions or frequency.</p>
      <div className="plan-banner"><div><Tag green>ACTIVE PLAN</Tag><h2>{plan.name}</h2><p>{plan.target_repetitions} target repetitions · {plan.sessions_per_day} session(s) per day</p><p>{plan.instructions}</p><small>Target angle range: start maximum {plan.start_max}° · target minimum {plan.target_min}°</small></div><div className="plan-progress"><b>{plan.active ? "Active" : "Inactive"}</b><span>Backend plan status</span></div><Button disabled={!plan.active} onClick={() => go("live")}><Icon name="camera"/> Open camera preview</Button></div>
    </> : <div className="notice" role="status"><Icon name="clinical"/><div><b>No active exercise plan yet</b><span>Your account is registered, but a clinician has not assigned an active plan. The generic demonstrations shown in the prototype are not a personalized prescription. Please wait for your clinician’s instructions before starting exercises.</span></div></div>}
    <div className="notice exercise-safety-notice"><Icon name="shield"/><div><b>Session tracking status</b><span>The camera page currently provides a camera preview only. It does not count repetitions or calculate joint angles, and this screen does not save a session until measured tracking data is connected.</span></div></div>
  </div>
}

function ExerciseDetail({ go }: { go: (p: Page) => void }) {
  const exercise = exercises[0]
  return <div className="narrow"><PageHead eyebrow="EXERCISE 1 OF 3" title={exercise.name} back={() => go("exercises")}/>
    <div className="detail-grid"><div className="detail-video-panel"><div className="exercise-embed-wrap detail-embed"><iframe src={exercise.videoUrl} title={`${exercise.name} demonstration`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div><a className="detail-source-link" href={exercise.videoPage} target="_blank" rel="noreferrer">Open demonstration source ↗</a></div>
      <div className="detail-copy"><Tag green>GENTLE · MOBILITY</Tag><h2>Move slowly and stay comfortable.</h2><div className="detail-stats"><div><b>3</b><span>Sets</span></div><div><b>10</b><span>Reps</span></div><div><b>45s</b><span>Rest</span></div></div><ol><li><b>01</b><span>Stand facing a wall with your fingertips resting at shoulder height.</span></li><li><b>02</b><span>Walk your fingers upward, keeping your shoulder relaxed.</span></li><li><b>03</b><span>Pause at a comfortable height, then return slowly.</span></li></ol><div className="safety"><Icon name="shield"/><span><b>Safety cue</b>Stop if you feel sharp pain, tingling, or instability.</span></div><Button onClick={() => go("live")}><Icon name="camera"/> Start camera session</Button></div>
    </div>
  </div>
}

function Live({ go, onLogout }: { go: (p: Page) => void; onLogout?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState("")
  const [paused, setPaused] = useState(false)
  const [sessionStartedAt] = useState(() => Date.now())
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream
    if (videoRef.current && stream && !paused) void videoRef.current.play().catch(() => undefined)
  }, [stream, paused])

  useEffect(() => {
    if (!stream || paused) return
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - sessionStartedAt) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [stream, paused, sessionStartedAt])

  useEffect(() => () => {
    stream?.getTracks().forEach(track => track.stop())
  }, [stream])

  const startCamera = async () => {
    setCameraError("")
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is unavailable in this browser. Use localhost or HTTPS and a supported browser.")
      return
    }
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
      setStream(cameraStream)
      setPaused(false)
    } catch (error) {
      const err = error as DOMException
      setCameraError(err.name === "NotAllowedError" ? "Camera permission was denied. Allow camera access in your browser settings, then try again." : "The camera could not be started. Check that it is connected and not being used by another app.")
    }
  }
  const stopCamera = () => {
    stream?.getTracks().forEach(track => track.stop())
    setStream(null)
    setPaused(false)
    if (videoRef.current) videoRef.current.srcObject = null
  }
  const togglePause = () => {
    const next = !paused
    setPaused(next)
    if (videoRef.current) {
      if (next) videoRef.current.pause()
      else void videoRef.current.play().catch(() => undefined)
    }
  }
  const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`

  return <div className="live-page"><div className="live-top"><button onClick={() => { stopCamera(); go("exercises") }}><Icon name="back"/> Exit</button><div><i className={stream ? "camera-live-dot" : ""}/> {stream ? "LIVE CAMERA PREVIEW" : "CAMERA NOT CONNECTED"}</div><span>Exercise 1 of 3</span>{onLogout && <button className="patient-live-logout" onClick={() => { stopCamera(); onLogout() }}>Sign out</button>}</div>
    <div className="live-grid"><div className={`camera ${stream ? "camera-active" : "camera-idle"}`}>
      <video ref={videoRef} className={`camera-video ${stream ? "visible" : ""}`} autoPlay playsInline muted aria-label="Live camera preview for exercise positioning" />
      {!stream && <div className="camera-placeholder"><div className="camera-placeholder-icon"><Icon name="camera" size={38}/></div><h2>Position yourself in frame</h2><p>Enable your camera to preview your movement. Movement analysis connects to the backend separately.</p><Button onClick={startCamera}><Icon name="camera"/> Enable camera</Button></div>}
      {stream && <div className="camera-ui"><span><i className="camera-live-dot"/> Camera preview active</span><Tag green>PREVIEW ONLY</Tag></div>}
      {stream && <div className="camera-bottom-note">Center your full movement in view · {paused ? "Preview paused" : "Camera on"}</div>}
      {cameraError && <div className="camera-error" role="alert">{cameraError}</div>}
    </div>
      <aside className="live-panel"><span className="eyebrow">WALL-ASSISTED FLEXION</span><h2>Move with control</h2><div className="rep-counter"><span>REPETITIONS</span><div><b>—</b><em>/ backend</em></div><div className="rep-dots"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><small>Rep counter will populate when the pose-estimation backend is connected.</small></div><div className="live-metrics"><div><span>Movement quality</span><b>Awaiting backend</b></div><div><span>Joint angle</span><b>—</b></div><div><span>Tracking confidence</span><b>—</b></div><div><span>Session timer</span><b>{formatTime(elapsedSeconds)}</b></div></div><div className="set-progress"><span>Session analytics</span><b>Awaiting backend</b><i><em style={{width: "0%"}}/></i></div><div className="live-actions">{stream && <Button variant="secondary" onClick={togglePause}>{paused ? <Icon name="play"/> : "Ⅱ"} {paused ? "Resume preview" : "Pause preview"}</Button>}{stream && <Button variant="secondary" onClick={stopCamera}>Turn off camera</Button>}<Button onClick={() => { stopCamera(); go("summary") }}>Finish session</Button></div><small className="disclaimer">This screen previews the camera only. Repetition counting, joint-angle calculation, movement quality and confidence values are intentionally not simulated; the backend pose model should populate them.</small></aside>
    </div></div>
}

function Summary({ go, patientName }: { go: (p: Page) => void; patientName: string }) {
  return <div className="narrow summary"><div className="success-mark"><Icon name="check" size={34}/></div><Tag>CAMERA PREVIEW COMPLETE</Tag><h1>Well done, {patientName.split(" ")[0]}.</h1><p>Your camera preview has ended. The current frontend does not yet run the pose tracker, so it cannot report repetitions, joint angles, or movement quality.</p>
    <div className="summary-score"><div className="score-ring large"><b>—</b><span>not measured</span></div><div><span className="eyebrow">SESSION SUMMARY</span><h2>No session measurements were recorded.</h2><p>We do not save a placeholder session when no measurements exist. Once the tracker supplies real measurements, the app can submit them to the backend session endpoint.</p></div></div>
    <div className="summary-metrics"><div><Icon name="move"/><b>—</b><span>Repetitions · not measured</span></div><div><Icon name="clock"/><b>—</b><span>Duration · not recorded</span></div><div><Icon name="target"/><b>—</b><span>Joint angle · not measured</span></div><div><Icon name="chart"/><b>—</b><span>Movement quality · not measured</span></div></div>
    <div className="notice"><Icon name="shield"/><div><b>Backend session saving is not enabled yet</b><span>This camera page is preview-only. No video or fabricated movement metrics were uploaded. Your saved history and progress pages show records returned by the backend.</span></div></div>
    <div className="center-actions"><Button variant="secondary" onClick={() => go("dashboard")}>Back to dashboard</Button><Button onClick={() => go("progress")}>View saved progress <Icon name="arrow"/></Button></div>
  </div>
}

function Progress({ go, data }: { go: (p: Page) => void; data: PatientDashboardData }) {
  const progress = data.progress
  const goodPercent = progress && progress.total_sessions > 0
    ? Math.round((progress.good_tracking_sessions / progress.total_sessions) * 100)
    : null
  return <div><PageHead eyebrow="YOUR RECOVERY" title="Progress report" action={<Tag>{data.loading ? "Loading" : "Live backend data"}</Tag>}/>
    <div className="progress-hero"><div><span className="eyebrow">MEASURED MOVEMENT</span><h2>{progress?.latest_max_angle != null ? `Latest maximum angle: ${progress.latest_max_angle.toFixed(1)}°` : "No reliable angle trend yet"}</h2><p>{progress?.usable_angle_measurements ? `Based on ${progress.usable_angle_measurements} good-tracking session(s) with angle measurements.` : "Angle trends appear only after saved sessions contain angle measurements with good tracking quality."}</p>{progress?.max_angle_change != null && <p>Change from the previous usable session: {progress.max_angle_change > 0 ? "+" : ""}{progress.max_angle_change.toFixed(1)}°.</p>}</div><div className="consistency"><div className="score-ring"><b>{data.loading ? "—" : goodPercent === null ? "—" : `${goodPercent}%`}</b><span>good tracking</span></div><h3>Tracking quality</h3><p>{progress ? `${progress.good_tracking_sessions} good · ${progress.fair_tracking_sessions} fair · ${progress.poor_tracking_sessions} poor` : "No saved tracking sessions yet."}</p></div></div>
    <div className="stat-grid"><div className="card"><span>Total sessions</span><b>{data.loading ? "—" : progress?.total_sessions ?? 0}</b><small>Saved in the backend</small></div><div className="card"><span>Total repetitions</span><b>{data.loading ? "—" : progress?.total_repetitions ?? 0}</b><small>Across saved sessions</small></div><div className="card"><span>Active minutes</span><b>{data.loading ? "—" : Math.round((progress?.total_duration_sec ?? 0) / 60)}</b><small>Summed session duration</small></div><div className="card"><span>Latest reported pain</span><b>{data.loading ? "—" : progress?.latest_reported_pain == null ? "—" : `${progress.latest_reported_pain}/10`}</b><small>{progress?.pain_change == null ? "No pain comparison available" : `Change: ${progress.pain_change > 0 ? "+" : ""}${progress.pain_change}`}</small></div></div>
    <div className="history-card card"><div className="section-head"><div><span className="eyebrow">SESSION HISTORY</span><h2>Recent saved activity</h2></div></div>{data.loading ? <p role="status">Loading session history…</p> : data.sessions.length ? data.sessions.map(session => <div className="history-row" key={session.id}><span>{formatSessionDate(session.started_at)}</span><div><b>{data.plan?.name || `Exercise #${session.exercise_id}`}</b><small>{formatDuration(session.duration_sec)} · {session.repetition_count} repetitions{session.patient_reported_pain == null ? "" : ` · pain ${session.patient_reported_pain}/10`}</small>{session.max_angle != null && <small>AI-estimated max angle: {session.max_angle.toFixed(1)}°</small>}</div><Tag green={session.tracking_quality === "good"}>{session.tracking_quality} tracking</Tag><button onClick={() => go("summary")} aria-label="Open session summary"><Icon name="arrow"/></button></div>) : <div className="empty-state"><Icon name="chart" size={36}/><h3>No saved sessions yet</h3><p>Recorded activity will appear here after the tracker is connected and a session with real measurements is saved.</p></div>}</div>
  </div>
}

function Insights({ go }: { go: (p: Page) => void }) {
  return <div className="narrow"><PageHead eyebrow="RECOVERLENS INSIGHTS" title="Small gains, clearly seen" back={()=>go("dashboard")}/>
    <div className="insight-hero"><div className="glow-spark"><Icon name="spark" size={30}/></div><div><Tag>DEMO AI INSIGHT</Tag><h2>Your movement is becoming more confident.</h2><p>Across the last four simulated sessions, your range stayed consistent while movement quality rose by 9%.</p></div></div>
    <div className="milestone-timeline"><div className="milestone done"><i><Icon name="check"/></i><div><span>JUNE 10</span><h3>First full session</h3><p>Completed all prescribed movements.</p></div></div><div className="milestone done"><i><Icon name="check"/></i><div><span>JUNE 18</span><h3>Quality above 85%</h3><p>Maintained smooth pacing for three sessions.</p></div></div><div className="milestone current"><i><Icon name="target"/></i><div><span>IN PROGRESS · 76%</span><h3>Comfortable overhead reach</h3><p>Current demo estimate: 142° · Goal: 150°</p><div className="progress-track"><i style={{width:"76%"}}/></div></div></div><div className="milestone"><i><Icon name="spark"/></i><div><span>NEXT</span><h3>Return to light activity</h3><p>Unlocks after consistent 150° movement.</p></div></div></div>
  </div>
}

function Clinical({ go, patientId, patientName, patientEmail, connectedClinician, onConnectClinician }: { go: (p: Page) => void; patientId: string; patientName: string; patientEmail: string; connectedClinician?: PatientConnection; onConnectClinician?: (code: string) => ConnectResult }) {
  const [code, setCode] = useState("")
  const [connectMessage, setConnectMessage] = useState("")
  const [connectError, setConnectError] = useState(false)
  const [copyMessage, setCopyMessage] = useState("")
  const submitCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = onConnectClinician?.(code) || { ok: false, message: "Connection is not available in this preview." }
    setConnectMessage(result.message)
    setConnectError(!result.ok)
    if (result.ok) setCode("")
  }
  const copyPatientId = async () => {
    try { await navigator.clipboard.writeText(patientId); setCopyMessage("Patient ID copied.") }
    catch { setCopyMessage(`Copy your ID manually: ${patientId}`) }
  }
  return <div><PageHead eyebrow="PHYSIOTHERAPIST-LED" title="Clinical Care" action={<Tag green><i className="green-dot"/> Care plan active</Tag>}/>
    <section className="patient-id-banner card"><div><span className="eyebrow">YOUR UNIQUE PATIENT ID</span><h2>{patientId}</h2><p>Share this ID when your physiotherapist asks to identify your patient record.</p></div><Button variant="secondary" onClick={copyPatientId}><Icon name="check"/> Copy ID</Button>{copyMessage && <small role="status">{copyMessage}</small>}</section>
    <section className="card connect-physio-card"><div className="connect-physio-heading"><span className="connect-physio-icon"><Icon name="clinical" size={24}/></span><div><span className="eyebrow">CONNECT YOUR CARE TEAM</span><h2>{connectedClinician ? "Your physiotherapist is connected" : "Connect to your physiotherapist"}</h2><p>Ask your physiotherapist for the unique code displayed in their dashboard, then enter it below.</p></div></div>
      {connectedClinician && <div className="connected-clinician-summary"><div className="avatar">{connectedClinician.clinicianName.split(" ").map(part => part[0]).join("").slice(0,2).toUpperCase()}</div><div><b>{connectedClinician.clinicianName}</b><span>{connectedClinician.clinicianEmail}</span><small>Code {connectedClinician.clinicianCode} · Connected {new Date(connectedClinician.connectedAt).toLocaleDateString()}</small></div><Tag green>Connected</Tag></div>}
      <form className="connect-code-form" onSubmit={submitCode}><label className="field"><span>Physiotherapist connection code</span><input value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setConnectMessage("") }} placeholder="PHY-01AB23C" autoCapitalize="characters" maxLength={11} required/><small>Example format: PHY-01AB23C</small></label><Button disabled={!code.trim()}><Icon name="link"/> {connectedClinician ? "Connect to another physiotherapist" : "Connect physiotherapist"}</Button></form>
      {connectMessage && <div className={`connection-feedback ${connectError ? "error" : "success"}`} role="status">{connectMessage}</div>}
      <p className="report-note">Prototype note: the code is validated against physiotherapists who have signed in on this browser. For real cross-device connections, the code and consent record must be verified by your backend.</p>
    </section>
    <section className="clinical-grid"><div><div className="section-head"><div><span className="eyebrow">PRESCRIBED ROUTINE</span><h2>{connectedClinician ? "Your connected care plan" : "Care plan preview"}</h2></div><Tag>{connectedClinician ? "CONNECTED" : "NOT CONNECTED"}</Tag></div><div className="clinical-routine card">{exercises.map((x,i)=><div className="routine-row" key={x.name}><span className="routine-num">0{i+1}</span><div><b>{x.name}</b><small>{x.sets} sets · {x.reps} reps · {x.duration}</small></div>{i===0?<Tag green>Today</Tag>:<Icon name="check"/>}</div>)}<Button onClick={()=>go("exercises")}><Icon name="play"/> View prescribed exercises</Button></div></div>
      <aside><div className="card review-card"><Icon name="clinical"/><h3>{connectedClinician ? "Connected clinical care" : "Connect to enable clinical care"}</h3><p>{connectedClinician ? `Your connection is linked to ${connectedClinician.clinicianName}. Session records can be shown in the same browser demo.` : "Once you connect using your physiotherapist’s code, their identity and your unique patient ID will be visible to them."}</p><Tag green={!!connectedClinician}>{connectedClinician ? "Connection active" : "Awaiting connection"}</Tag></div><div className="card"><span className="eyebrow">SAFETY NOTE</span><blockquote>Follow the routine prescribed for you. Do not increase intensity based on demo metrics.</blockquote><small>RecoverLens AI · Patient guidance</small></div></aside>
    </section>
    <div className="history-card card"><div className="section-head"><div><span className="eyebrow">CLINICAL SESSION HISTORY</span><h2>Shared activity</h2></div></div>{["21 Jun","19 Jun","17 Jun"].map((d,i)=><div className="history-row" key={d}><span>{d}</span><div><b>Prescribed mobility routine</b><small>{18-i} min · 3 exercises</small></div><Tag green>{i===2?"Reviewed":"Ready to submit"}</Tag><button onClick={()=>go("progress")}><Icon name="arrow"/></button></div>)}</div>
  </div>
}

function Profile({ go, patientId, patientName, patientEmail, data }: { go: (p: Page) => void; patientId: string; patientName: string; patientEmail: string; data: PatientDashboardData }) {
  const initials = patientName.split(" ").map(part => part[0]).join("").slice(0,2).toUpperCase()
  const profile = data.profile
  const recoveryStart = profile?.recovery_start ? formatSessionDate(profile.recovery_start) : "Not recorded"
  return <div className="narrow"><PageHead eyebrow="ACCOUNT" title="Profile"/>
    <div className="profile-hero card"><div className="profile-avatar">{initials}</div><div><h2>{profile?.display_name || patientName}</h2><p>{patientEmail} · Patient ID {patientId}</p><Tag green={!!data.plan}>{data.plan ? "Exercise plan active" : data.loading ? "Loading plan status" : "Awaiting exercise plan"}</Tag></div><Button variant="secondary" disabled>Edit profile</Button></div>
    <div className="profile-grid"><div className="card profile-menu"><button onClick={() => go("settings")}><span><Icon name="settings"/><div><b>Settings</b><small>Preferences and accessibility</small></div></span><Icon name="arrow"/></button><button onClick={() => go("notifications")}><span><Icon name="bell"/><div><b>Notifications</b><small>Reminder preferences (local prototype)</small></div></span><Icon name="arrow"/></button><div className="setting-row"><div><b>Health data & consent</b><span>Backend consent status: {profile?.consent_status || "not loaded"}</span></div></div></div><div className="card care-details"><span className="eyebrow">CARE DETAILS FROM BACKEND</span><div><span>Recovery pathway</span><b>{profile?.pathway || "Not set"}</b></div><div><span>Recovery start</span><b>{recoveryStart}</b></div><div><span>Assigned clinician</span><b>{profile?.clinician_name || "Not assigned"}</b></div><div><span>Consent status</span><b>{profile?.consent_status || "Unknown"}</b></div><div><span>Patient ID</span><b>{profile?.id ?? patientId}</b></div>{data.error && <small role="alert">Profile details could not be refreshed: {data.error}</small>}</div></div>
  </div>
}

function Settings({ go }: { go: (p: Page) => void }) {
  const [toggles,setToggles]=useState([true,true,false])
  return <div className="narrow"><PageHead eyebrow="PROFILE" title="Settings" back={()=>go("profile")}/><div className="settings-card card"><h3>Experience</h3>{["Daily exercise reminders","Movement cue sounds","Reduced motion"].map((t,i)=><div className="setting-row" key={t}><div><b>{t}</b><span>{["Get a gentle prompt at your preferred time","Audio feedback during demo sessions","Minimise interface animations"][i]}</span></div><button className={`toggle ${toggles[i]?"on":""}`} onClick={()=>setToggles(v=>v.map((x,j)=>j===i?!x:x))}><i/></button></div>)}</div><div className="settings-card card"><h3>Privacy</h3><div className="setting-row"><div><b>Share clinical sessions</b><span>Ask before submitting each session</span></div><select><option>Always ask</option><option>Automatically</option></select></div></div></div>
}

function Notifications({ go }: { go: (p: Page) => void }) {
  return <div className="narrow"><PageHead eyebrow="PROFILE" title="Notifications" back={()=>go("profile")} action={<button className="text-button">Mark all as read</button>}/><div className="notifications">{[
    ["clinical","Dr. Shah reviewed your session","“Great control. Continue with the same range this week.”","12 min ago"],
    ["target","You’re close to a milestone","Just 8° to your comfortable overhead reach goal.","Yesterday"],
    ["clock","Today’s plan is ready","Your 18-minute mobility session is waiting.","Yesterday"],
  ].map((n,i)=><div className={`notification ${i===0?"unread":""}`} key={n[1]}><div className="notification-icon"><Icon name={n[0]}/></div><div><b>{n[1]}</b><p>{n[2]}</p><small>{n[3]}</small></div>{i===0&&<i/>}</div>)}</div></div>
}

export default function PatientDashboard({ onLogout, patientId, patientName, patientEmail, connectedClinician, onConnectClinician, onPrescriptionSubmitted }: PatientDashboardProps) {
  const [page, setPage] = useState<Page>("dashboard")
  const [comfortView, setComfortView] = useState(false)
  const [backendData, setBackendData] = useState<PatientDashboardData>(emptyPatientData)
  const mainRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const numericPatientId = Number(patientId)
    let cancelled = false

    if (!Number.isSafeInteger(numericPatientId) || numericPatientId <= 0) {
      setBackendData({ ...emptyPatientData, loading: false, error: "The authenticated account does not have a valid patient record ID." })
      return () => { cancelled = true }
    }

    setBackendData({ ...emptyPatientData, loading: true, error: null })
    Promise.all([
      getPatientProfile(numericPatientId),
      getPatientExercisePlan(numericPatientId),
      getPatientSessions(numericPatientId),
      getPatientProgress(numericPatientId),
    ])
      .then(([profile, plan, sessions, progress]) => {
        if (!cancelled) setBackendData({ profile, plan, sessions, progress, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : "Could not load patient data."
        setBackendData({ ...emptyPatientData, loading: false, error: message })
      })

    return () => { cancelled = true }
  }, [patientId])
  const go = (p: Page) => { setPage(p); requestAnimationFrame(()=>mainRef.current?.scrollTo({top:0,behavior:"smooth"})) }
  const navPage = page === "results" || page === "processing" ? "assessment" : page === "exercise" || page === "live" || page === "summary" ? "exercises" : page
  const content = page === "dashboard" ? <Dashboard go={go} patientName={patientName} data={backendData}/> : page === "assessment" ? <Assessment go={go} onPrescriptionSubmitted={onPrescriptionSubmitted}/> : page === "processing" ? <Processing go={go}/> : page === "results" ? <Results go={go}/> : page === "exercises" ? <Exercises go={go} data={backendData}/> : page === "exercise" ? <ExerciseDetail go={go}/> : page === "live" ? <Live go={go} onLogout={onLogout}/> : page === "summary" ? <Summary go={go} patientName={patientName}/> : page === "progress" ? <Progress go={go} data={backendData}/> : page === "insights" ? <Insights go={go}/> : page === "clinical" ? <Clinical go={go} patientId={patientId} patientName={patientName} patientEmail={patientEmail} connectedClinician={connectedClinician} onConnectClinician={onConnectClinician}/> : page === "profile" ? <Profile go={go} patientId={patientId} patientName={patientName} patientEmail={patientEmail} data={backendData}/> : page === "settings" ? <Settings go={go}/> : <Notifications go={go}/>
  if (page === "live") return <div className="patient-root">{content}</div>
  return <div className="patient-root"><div className={`app-shell ${comfortView ? "comfort-view" : ""}`}>
    <button className="skip-link" onClick={() => mainRef.current?.focus()}>Skip to main content</button>
    <aside className="sidebar"><button className="brand" onClick={()=>go("dashboard")} aria-label="RecoverLens AI dashboard"><img className="dashboard-brand-logo" src="/assets/recoverlens-original-logo.png" alt="RecoverLens AI — Rehabilitate, Track, Progress" /></button><div className="sidebar-label">PATIENT PORTAL</div><nav>{nav.map(([id,icon,label])=><button key={id} className={navPage===id?"active":""} onClick={()=>go(id as Page)}><Icon name={icon}/><span>{label}</span>{id==="clinical"&&<i className="nav-dot"/>}</button>)}</nav><div className="care-team"><div className="avatar small">{connectedClinician ? connectedClinician.clinicianName.split(" ").map(part=>part[0]).join("").slice(0,2).toUpperCase() : "RL"}</div><div><small>Care team</small><b>{connectedClinician?.clinicianName || "Not connected yet"}</b></div><i className={connectedClinician ? "online" : ""}/></div><button className="help"><Icon name="shield"/><span><b>Need help?</b><small>Safety & support</small></span></button></aside>
    <main ref={mainRef} tabIndex={-1}><div className="topbar"><button className="mobile-brand" onClick={()=>go("dashboard")} aria-label="RecoverLens AI dashboard"><img src="/assets/recoverlens-original-logo.png" alt="RecoverLens AI" /></button><div className="topbar-message"><i/><span><b>Your care space</b><small>Private · calm · at your pace</small></span></div><div className="top-actions"><button className={`readability ${comfortView ? "active" : ""}`} onClick={()=>setComfortView(!comfortView)} aria-pressed={comfortView} aria-label="Toggle larger, more readable text"><b>Aa</b><span>Comfort view</span></button><button className="icon-btn" onClick={()=>go("notifications")} aria-label="Notifications"><Icon name="bell"/><i/></button><button className="user-chip" onClick={()=>go("profile")} aria-label={`Open ${patientName} profile`}><span>{patientName.split(" ").map(part => part[0]).join("").slice(0,2).toUpperCase()}</span><div><b>{patientName}</b><small>{patientId}</small></div></button>{onLogout && <button className="patient-logout" onClick={onLogout}>Sign out</button>}</div></div><div className="content">{backendData.loading && <div className="notice" role="status"><Icon name="clock"/><div><b>Loading your secure recovery data</b><span>Connecting to your patient profile, assigned plan, saved sessions, and progress.</span></div></div>}{backendData.error && <div className="notice" role="alert"><Icon name="shield"/><div><b>Could not load backend data</b><span>{backendData.error}. Confirm the API is running at the configured address and that this account can access its patient record.</span></div></div>}{content}</div></main>
    <nav className="bottom-nav">{nav.slice(0,5).map(([id,icon,label])=><button key={id} className={navPage===id?"active":""} onClick={()=>go(id as Page)}><Icon name={icon}/><span>{label==="Clinical Care"?"Clinical":label}</span></button>)}<button className={navPage==="profile"?"active":""} onClick={()=>go("profile")}><Icon name="user"/><span>Profile</span></button></nav>
  </div></div>
}
