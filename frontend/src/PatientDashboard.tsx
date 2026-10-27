import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import type { ConnectResult, PatientConnection, PrescriptionRequest, SessionRecord } from "./CareContext"
import "./patient-dashboard.css"

type PatientDashboardProps = {
  onLogout?: () => void
  patientId: string
  patientName: string
  patientEmail: string
  connectedClinician?: PatientConnection
  onConnectClinician?: (code: string) => ConnectResult
  onSessionSaved?: (session: SessionRecord) => void
  onPrescriptionSubmitted?: (request: Omit<PrescriptionRequest, "status" | "review">) => void
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

function Orbit() {
  return <div className="orbit-wrap">
    <div className="orbit">
      <svg viewBox="0 0 220 220"><circle className="orbit-base" cx="110" cy="110" r="92"/><circle className="orbit-fill" cx="110" cy="110" r="92"/><circle className="orbit-inner" cx="110" cy="110" r="74"/></svg>
      <div className="orbit-center"><b>68%</b><span>recovery score</span></div>
      <i className="node n1"/><i className="node n2"/><i className="node n3"/>
    </div>
    <div className="orbit-meta"><Tag green>On track</Tag><p>Mobility is improving steadily</p><small>+8% since last week</small></div>
  </div>
}

function PageHead({ title, eyebrow, back, action }: { title: string; eyebrow: string; back?: () => void; action?: ReactNode }) {
  return <header className="page-head"><div>{back && <button className="icon-btn back" onClick={back}><Icon name="back"/></button>}<div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1></div></div>{action}</header>
}

function Dashboard({ go, patientName }: { go: (p: Page) => void; patientName: string }) {
  const [comfort, setComfort] = useState("Steady")
  return <div>
    <PageHead eyebrow="YOUR RECOVERY SPACE" title={`Good morning, ${patientName.split(" ")[0]}.`} action={<Button variant="secondary" onClick={() => go("assessment")}><Icon name="spark"/> Ask RecoverLens</Button>} />
    <p className="intro">Your shoulder recovery is moving in the right direction. Let’s work with how your body feels today.</p>
    <section className="daily-checkin" aria-label="Daily comfort check-in">
      <div className="checkin-intro"><span className="pulse-mark"><i/><i/></span><div><span className="eyebrow">DAILY CHECK-IN</span><b>How does movement feel right now?</b></div></div>
      <div className="feeling-options">
        {[["Comfortable","Easy range today"],["Steady","A little aware"],["Sensitive","Take it gently"]].map(([label,hint]) => <button key={label} className={comfort === label ? "active" : ""} onClick={() => setComfort(label)} aria-pressed={comfort === label}><i/><span><b>{label}</b><small>{hint}</small></span></button>)}
      </div>
      <span className="checkin-note">{comfort === "Sensitive" ? "We’ll keep today gentle." : comfort === "Comfortable" ? "Great — stay within a pain-free range." : "Your plan already matches this pace."}</span>
    </section>
    <section className="hero-grid">
      <div className="card orbit-card"><div className="card-label"><Icon name="target"/> Recovery Orbit</div><Orbit/></div>
      <div className="today-card">
        <div><Tag green>Today’s plan</Tag><h2>Build mobility,<br/>without the strain.</h2><p>18 minutes · 3 guided movements</p></div>
        <div className="today-visual"><div className="figure"><span/><span/><span/><span/><span/></div><div className="arc"/></div>
        <Button onClick={() => go("exercises")}><Icon name="play"/> Begin today’s session</Button>
      </div>
    </section>
    <section className="mode-grid">
      <button className="mode ai" onClick={() => go("assessment")}><span className="mode-number">01</span><div className="mode-icon"><Icon name="spark" size={24}/></div><div><small>SELF-GUIDED</small><h3>AI Recovery</h3><p>Create a demo personalised plan from your symptoms or prescription.</p></div><span className="circle-arrow"><Icon name="arrow"/></span></button>
      <button className="mode clinical" onClick={() => go("clinical")}><span className="mode-number">02</span><div className="mode-icon"><Icon name="clinical" size={24}/></div><div><small>PHYSIOTHERAPIST-LED</small><h3>Clinical Care</h3><p>Follow your connected physiotherapist’s prescribed routine and share session data.</p></div><span className="circle-arrow"><Icon name="arrow"/></span></button>
    </section>
    <section className="dashboard-lower">
      <div className="card activity"><div className="card-title"><div><span className="eyebrow">ACTIVITY</span><h3>Your week in motion</h3></div><strong>4 <small>sessions</small></strong></div><MiniChart bars/><div className="metric-row"><div><b>72</b><span>Minutes</span></div><div><b>87%</b><span>Quality</span></div><div><b>4 day</b><span>Streak</span></div></div></div>
      <div className="card"><div className="card-title"><div><span className="eyebrow">NEXT MILESTONE</span><h3>Full overhead reach</h3></div><span className="milestone-icon"><Icon name="target"/></span></div><p className="muted">You’re 8° away from your next mobility goal.</p><div className="progress-track"><i style={{width:"76%"}}/></div><div className="progress-label"><b>142° current</b><span>Goal 150°</span></div><Button variant="ghost" onClick={() => go("insights")}>View all insights <Icon name="arrow"/></Button></div>
    </section>
    <section className="recent"><div className="section-head"><div><span className="eyebrow">HISTORY</span><h2>Recent sessions</h2></div><button onClick={() => go("progress")}>View progress <Icon name="arrow"/></button></div>
      <div className="session-row"><div className="session-date"><b>21</b><span>JUN</span></div><div className="session-play"><Icon name="play"/></div><div><b>Shoulder mobility routine</b><span>18 min · 3 exercises</span></div><Tag green>92% quality</Tag><span className="submitted"><Icon name="check"/> Completed</span></div>
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

function Exercises({ go }: { go: (p: Page) => void }) {
  return <div>
    <PageHead eyebrow="AI RECOVERY · WEEK 2" title="Your exercise plan" action={<Tag green>3 of 4 sessions</Tag>}/>
    <p className="intro">Watch the demonstrations for your prescribed movements, then use the camera preview for your session. Follow your clinician-approved routine and stop if discomfort increases.</p>
    <div className="plan-banner"><div><Tag>TODAY · SESSION 4</Tag><h2>Mobility & control</h2><p>3 exercises · 18 minutes · Moderate intensity</p></div><div className="plan-progress"><b>75%</b><span>Weekly plan</span></div><Button onClick={() => go("live")}><Icon name="play"/> Start camera session</Button></div>
    <div className="exercise-demo-grid">
      {exercises.map((x, i) => <article className="exercise-demo-card card" key={x.name}>
        <div className={`exercise-demo-thumb ${x.tone}`}><span>{String(i+1).padStart(2,"0")}</span><div className="mini-person"><i/><i/><i/></div></div>
        <div className="exercise-demo-heading"><div><Tag>{x.level}</Tag><h3>{x.name}</h3><p>{x.area} · {x.sets} sets × {x.reps} reps · {x.duration}</p></div></div>
        <div className="exercise-embed-wrap"><iframe src={x.videoUrl} title={`${x.name} demonstration`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div>
        <p className="exercise-demo-instructions">{x.instructions}</p>
        <div className="exercise-demo-source">Video source: <a href={x.videoPage} target="_blank" rel="noreferrer">{x.videoSource} ↗</a></div>
        <div className="exercise-demo-actions"><Button variant="secondary" onClick={() => go("exercise")}>View instructions</Button><Button onClick={() => go("live")}><Icon name="camera"/> Monitor with camera</Button></div>
      </article>)}
    </div>
    <div className="notice exercise-safety-notice"><Icon name="shield"/><div><b>Exercise safety</b><span>These videos are demonstrations, not a personalized treatment recommendation. Follow the exercises prescribed for you by your physiotherapist and stop if pain or instability increases.</span></div></div>
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

  return <div className="live-page"><div className="live-top"><button onClick={() => { stopCamera(); go("exercise") }}><Icon name="back"/> Exit</button><div><i className={stream ? "camera-live-dot" : ""}/> {stream ? "LIVE CAMERA PREVIEW" : "CAMERA NOT CONNECTED"}</div><span>Exercise 1 of 3</span>{onLogout && <button className="patient-live-logout" onClick={() => { stopCamera(); onLogout() }}>Sign out</button>}</div>
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

function Summary({ go, onSessionSaved, patientName, connectedClinician }: { go: (p: Page) => void; onSessionSaved?: (session: SessionRecord) => void; patientName: string; connectedClinician?: PatientConnection }) {
  const [submitted, setSubmitted] = useState(false)
  return <div className="narrow summary"><div className="success-mark"><Icon name="check" size={34}/></div><Tag green>SESSION COMPLETE</Tag><h1>Well done, {patientName.split(" ")[0]}.</h1><p>Your camera preview session is complete. The backend will provide repetition counts, joint angles, and movement-quality metrics when connected.</p>
    <div className="summary-score"><div className="score-ring large"><b>—</b><span>awaiting backend</span></div><div><span className="eyebrow">SESSION SUMMARY</span><h2>Your session is ready to record.</h2><p>No movement metrics have been fabricated. Real measurements will appear here when the pose-estimation service is integrated.</p></div></div>
    <div className="summary-metrics"><div><Icon name="move"/><b>—</b><span>Repetitions · backend</span></div><div><Icon name="clock"/><b>—</b><span>Duration · session data</span></div><div><Icon name="target"/><b>—</b><span>Joint angle · backend</span></div><div><Icon name="chart"/><b>Awaiting</b><span>Movement quality</span></div></div>
    <div className="submit-card"><div><Icon name="clinical"/><span><b>{connectedClinician ? `Share with ${connectedClinician.clinicianName}` : "Connect a physiotherapist first"}</b>{connectedClinician ? `Session summary for ${connectedClinician.clinicianName} is ready to submit for demo review.` : "Open Clinical Care and enter your physiotherapist's connection code before sharing session records."}</span></div><Button variant="secondary" disabled={!connectedClinician} onClick={() => { onSessionSaved?.({ exercise: "Camera exercise session", reps: 0, pain: null, reviewed: false }); setSubmitted(true) }}>{submitted ? "Submitted for review" : "Submit for review"}</Button>{submitted && <small className="submit-confirmation">Session record saved to the clinician demo review queue. Metrics are pending backend integration.</small>}</div>
    <div className="center-actions"><Button variant="secondary" onClick={() => go("dashboard")}>Back to dashboard</Button><Button onClick={() => go("progress")}>View progress <Icon name="arrow"/></Button></div>
  </div>
}

function Progress({ go }: { go: (p: Page) => void }) {
  return <div><PageHead eyebrow="YOUR RECOVERY" title="Progress report" action={<select className="period"><option>Last 30 days</option><option>Last 90 days</option></select>}/>
    <div className="progress-hero"><div><span className="eyebrow">MOBILITY TREND</span><h2>Range is up <strong>18°</strong></h2><p>Steady improvement across 12 completed sessions.</p><MiniChart/></div><div className="consistency"><div className="score-ring"><b>86%</b><span>consistency</span></div><h3>Excellent rhythm</h3><p>11 of 12 planned sessions completed.</p></div></div>
    <div className="stat-grid"><div className="card"><span>Total sessions</span><b>24</b><small>+6 this month</small></div><div className="card"><span>Active minutes</span><b>386</b><small>6h 26m total</small></div><div className="card"><span>Avg. quality</span><b>87%</b><small>Demo metric</small></div><div className="card"><span>Current streak</span><b>4 days</b><small>Personal best: 7</small></div></div>
    <div className="history-card card"><div className="section-head"><div><span className="eyebrow">SESSION HISTORY</span><h2>Recent activity</h2></div></div>{["21 Jun","19 Jun","17 Jun","14 Jun"].map((date,i)=><div className="history-row" key={date}><span>{date}</span><div><b>{i===2?"Strength & stability":"Shoulder mobility routine"}</b><small>{16+i} min · 3 exercises</small></div><Tag green>{[92,88,85,90][i]}% quality</Tag><button onClick={()=>go("summary")}><Icon name="arrow"/></button></div>)}</div>
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

function Profile({ go, patientId, patientName, patientEmail, connectedClinician }: { go: (p: Page) => void; patientId: string; patientName: string; patientEmail: string; connectedClinician?: PatientConnection }) {
  const initials = patientName.split(" ").map(part => part[0]).join("").slice(0,2).toUpperCase()
  return <div className="narrow"><PageHead eyebrow="ACCOUNT" title="Profile"/>
    <div className="profile-hero card"><div className="profile-avatar">{initials}</div><div><h2>{patientName}</h2><p>{patientEmail} · Patient ID {patientId}</p><Tag green>Recovery plan active</Tag></div><Button variant="secondary">Edit profile</Button></div>
    <div className="profile-grid"><div className="card profile-menu"><button onClick={()=>go("settings")}><span><Icon name="settings"/><div><b>Settings</b><small>Preferences, accessibility, privacy</small></div></span><Icon name="arrow"/></button><button onClick={()=>go("notifications")}><span><Icon name="bell"/><div><b>Notifications</b><small>Reminders and clinical updates</small></div></span><Icon name="arrow"/></button><button><span><Icon name="shield"/><div><b>Health data & consent</b><small>Manage your prototype data</small></div></span><Icon name="arrow"/></button></div><div className="card care-details"><span className="eyebrow">CARE DETAILS</span><div><span>Primary focus</span><b>Right shoulder mobility</b></div><div><span>Plan started</span><b>10 June 2025</b></div><div><span>Physiotherapist</span><b>{connectedClinician?.clinicianName || "Not connected yet"}</b></div><div><span>Patient ID</span><b>{patientId}</b></div></div></div>
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

export default function PatientDashboard({ onLogout, patientId, patientName, patientEmail, connectedClinician, onConnectClinician, onSessionSaved, onPrescriptionSubmitted }: PatientDashboardProps) {
  const [page, setPage] = useState<Page>("dashboard")
  const [comfortView, setComfortView] = useState(false)
  const mainRef = useRef<HTMLElement | null>(null)
  const go = (p: Page) => { setPage(p); requestAnimationFrame(()=>mainRef.current?.scrollTo({top:0,behavior:"smooth"})) }
  const navPage = page === "results" || page === "processing" ? "assessment" : page === "exercise" || page === "live" || page === "summary" ? "exercises" : page
  const content = page === "dashboard" ? <Dashboard go={go} patientName={patientName}/> : page === "assessment" ? <Assessment go={go} onPrescriptionSubmitted={onPrescriptionSubmitted}/> : page === "processing" ? <Processing go={go}/> : page === "results" ? <Results go={go}/> : page === "exercises" ? <Exercises go={go}/> : page === "exercise" ? <ExerciseDetail go={go}/> : page === "live" ? <Live go={go} onLogout={onLogout}/> : page === "summary" ? <Summary go={go} onSessionSaved={onSessionSaved} patientName={patientName} connectedClinician={connectedClinician}/> : page === "progress" ? <Progress go={go}/> : page === "insights" ? <Insights go={go}/> : page === "clinical" ? <Clinical go={go} patientId={patientId} patientName={patientName} patientEmail={patientEmail} connectedClinician={connectedClinician} onConnectClinician={onConnectClinician}/> : page === "profile" ? <Profile go={go} patientId={patientId} patientName={patientName} patientEmail={patientEmail} connectedClinician={connectedClinician}/> : page === "settings" ? <Settings go={go}/> : <Notifications go={go}/>
  if (page === "live") return <div className="patient-root">{content}</div>
  return <div className="patient-root"><div className={`app-shell ${comfortView ? "comfort-view" : ""}`}>
    <button className="skip-link" onClick={() => mainRef.current?.focus()}>Skip to main content</button>
    <aside className="sidebar"><button className="brand" onClick={()=>go("dashboard")} aria-label="RecoverLens AI dashboard"><img className="dashboard-brand-logo" src="/assets/recoverlens-original-logo.png" alt="RecoverLens AI — Rehabilitate, Track, Progress" /></button><div className="sidebar-label">PATIENT PORTAL</div><nav>{nav.map(([id,icon,label])=><button key={id} className={navPage===id?"active":""} onClick={()=>go(id as Page)}><Icon name={icon}/><span>{label}</span>{id==="clinical"&&<i className="nav-dot"/>}</button>)}</nav><div className="care-team"><div className="avatar small">{connectedClinician ? connectedClinician.clinicianName.split(" ").map(part=>part[0]).join("").slice(0,2).toUpperCase() : "RL"}</div><div><small>Care team</small><b>{connectedClinician?.clinicianName || "Not connected yet"}</b></div><i className={connectedClinician ? "online" : ""}/></div><button className="help"><Icon name="shield"/><span><b>Need help?</b><small>Safety & support</small></span></button></aside>
    <main ref={mainRef} tabIndex={-1}><div className="topbar"><button className="mobile-brand" onClick={()=>go("dashboard")} aria-label="RecoverLens AI dashboard"><img src="/assets/recoverlens-original-logo.png" alt="RecoverLens AI" /></button><div className="topbar-message"><i/><span><b>Your care space</b><small>Private · calm · at your pace</small></span></div><div className="top-actions"><button className={`readability ${comfortView ? "active" : ""}`} onClick={()=>setComfortView(!comfortView)} aria-pressed={comfortView} aria-label="Toggle larger, more readable text"><b>Aa</b><span>Comfort view</span></button><button className="icon-btn" onClick={()=>go("notifications")} aria-label="Notifications"><Icon name="bell"/><i/></button><button className="user-chip" onClick={()=>go("profile")} aria-label={`Open ${patientName} profile`}><span>{patientName.split(" ").map(part => part[0]).join("").slice(0,2).toUpperCase()}</span><div><b>{patientName}</b><small>{patientId}</small></div></button>{onLogout && <button className="patient-logout" onClick={onLogout}>Sign out</button>}</div></div><div className="content">{content}</div></main>
    <nav className="bottom-nav">{nav.slice(0,5).map(([id,icon,label])=><button key={id} className={navPage===id?"active":""} onClick={()=>go(id as Page)}><Icon name={icon}/><span>{label==="Clinical Care"?"Clinical":label}</span></button>)}<button className={navPage==="profile"?"active":""} onClick={()=>go("profile")}><Icon name="user"/><span>Profile</span></button></nav>
  </div></div>
}
