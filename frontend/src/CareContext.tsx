import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import './care-context.css'

export type PrescriptionRequest = {
  name: string
  size: number
  url: string
  notes: string
  status: string
  review: string
  patientId?: string
  patientName?: string
  patientEmail?: string
}

export type SessionRecord = {
  exercise: string
  reps: number
  pain: number | null
  reviewed: boolean
  patientId?: string
  patientName?: string
}

export type ChatMessage = { text: string; role: 'Patient' | 'Clinician' | string }

export type PatientIdentity = { id: string; name: string; email: string }
export type ClinicianProfile = { email: string; name: string; code: string; registeredAt: string }
export type PatientConnection = {
  patientId: string
  patientName: string
  patientEmail: string
  clinicianEmail: string
  clinicianName: string
  clinicianCode: string
  connectedAt: string
  status: 'Connected'
}
export type ConnectResult = { ok: boolean; message: string; connection?: PatientConnection }

const CLINICIANS_KEY = 'recoverlens.demo.clinicians.v1'
const CONNECTIONS_KEY = 'recoverlens.demo.patientConnections.v1'
const PATIENTS_KEY = 'recoverlens.demo.patientIdentities.v1'

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function writeStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* local persistence is best-effort in this demo */ }
}

function displayNameFromEmail(email: string) {
  const local = (email.split('@')[0] || 'patient').replace(/[._+-]+/g, ' ').trim()
  return local.replace(/\b\w/g, (char) => char.toUpperCase()) || 'Patient'
}

export function getOrCreatePatientIdentity(email: string): PatientIdentity {
  const normalized = email.trim().toLowerCase()
  const identities = readStorage<Record<string, string>>(PATIENTS_KEY, {})
  let id = identities[normalized]
  if (!id) {
    const used = Object.values(identities).map(value => { const parts = value.split('-'); return Number(parts[parts.length - 1] || 0) }).filter(Number.isFinite)
    let serial = Math.max(1000, ...used) + 1
    const usedIds = new Set(Object.values(identities))
    id = `RL-P-${serial}`
    while (usedIds.has(id)) { serial += 1; id = `RL-P-${serial}` }
    identities[normalized] = id
    writeStorage(PATIENTS_KEY, identities)
  }
  return { id, email: normalized, name: displayNameFromEmail(normalized) }
}

export function getClinicianCode(email: string): string {
  const normalized = email.trim().toLowerCase() || 'demo-physiotherapist'
  // Stable demo code for the same email; real codes must be issued and validated by the backend.
  let hash = 2166136261
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const suffix = (hash >>> 0).toString(36).toUpperCase().padStart(7, '0').slice(-7)
  return `PHY-${suffix}`
}

function clinicianNameFromEmail(email: string) {
  const name = displayNameFromEmail(email)
  return /^dr\.?\s/i.test(name) ? name.replace(/^dr\.?\s*/i, 'Dr. ') : `Dr. ${name}`
}

type CareContextValue = {
  request: PrescriptionRequest | null
  setRequest: Dispatch<SetStateAction<PrescriptionRequest | null>>
  plan: string
  setPlan: Dispatch<SetStateAction<string>>
  sessions: SessionRecord[]
  setSessions: Dispatch<SetStateAction<SessionRecord[]>>
  chat: ChatMessage[]
  setChat: Dispatch<SetStateAction<ChatMessage[]>>
  clinicians: ClinicianProfile[]
  patientConnections: PatientConnection[]
  registerClinician: (email: string) => ClinicianProfile
  connectPatientToClinician: (patient: PatientIdentity, code: string) => ConnectResult
  getConnectionForPatient: (patientId: string) => PatientConnection | undefined
  getConnectionsForClinician: (email: string) => PatientConnection[]
}

const CareContext = createContext<CareContextValue | null>(null)

export function CareProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<PrescriptionRequest | null>(null)
  const [plan, setPlan] = useState('Shoulder mobility · Phase 1')
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [clinicians, setClinicians] = useState<ClinicianProfile[]>(() => readStorage(CLINICIANS_KEY, []))
  const [patientConnections, setPatientConnections] = useState<PatientConnection[]>(() => readStorage(CONNECTIONS_KEY, []))

  const registerClinician = (email: string): ClinicianProfile => {
    const normalized = email.trim().toLowerCase()
    const code = getClinicianCode(normalized)
    const existing = clinicians.find(item => item.email === normalized)
    const profile: ClinicianProfile = {
      email: normalized,
      name: existing?.name || clinicianNameFromEmail(normalized),
      code,
      registeredAt: existing?.registeredAt || new Date().toISOString(),
    }
    setClinicians(previous => {
      const next = [...previous.filter(item => item.email !== normalized), profile]
      writeStorage(CLINICIANS_KEY, next)
      return next
    })
    return profile
  }

  const connectPatientToClinician = (patient: PatientIdentity, codeInput: string): ConnectResult => {
    const code = codeInput.trim().toUpperCase()
    if (!/^PHY-[A-Z0-9]{7}$/.test(code)) {
      return { ok: false, message: 'Enter the full physiotherapist code, for example PHY-01AB23C.' }
    }
    const clinician = clinicians.find(item => item.code.toUpperCase() === code)
    if (!clinician) {
      return { ok: false, message: 'That code is not registered in this browser demo yet. Ask the physiotherapist to sign in once and share the code shown on their dashboard.' }
    }
    if (clinician.email === patient.email) {
      return { ok: false, message: 'Use a physiotherapist account code, not your own patient account.' }
    }
    const connection: PatientConnection = {
      patientId: patient.id,
      patientName: patient.name,
      patientEmail: patient.email,
      clinicianEmail: clinician.email,
      clinicianName: clinician.name,
      clinicianCode: clinician.code,
      connectedAt: new Date().toISOString(),
      status: 'Connected',
    }
    setPatientConnections(previous => {
      const next = [...previous.filter(item => item.patientId !== patient.id), connection]
      writeStorage(CONNECTIONS_KEY, next)
      return next
    })
    return { ok: true, message: `Connected to ${clinician.name}. Your patient ID is ${patient.id}.`, connection }
  }

  const getConnectionForPatient = (patientId: string) => patientConnections.find(item => item.patientId === patientId)
  const getConnectionsForClinician = (email: string) => patientConnections.filter(item => item.clinicianEmail === email.trim().toLowerCase())

  const value: CareContextValue = {
    request, setRequest, plan, setPlan, sessions, setSessions, chat, setChat,
    clinicians, patientConnections, registerClinician, connectPatientToClinician,
    getConnectionForPatient, getConnectionsForClinician,
  }
  return <CareContext.Provider value={value}>{children}</CareContext.Provider>
}

export function useCare() {
  const value = useContext(CareContext)
  if (!value) throw new Error('useCare must be used inside CareProvider')
  return value
}

export function Glyph({ kind = 'move', size = 22 }: { kind?: string; size?: number }) {
  const paths: Record<string, string> = {
    move: 'M2 12h4l3-8 5 16 3-8h5', document: 'M6 3h9l4 4v14H6z M10 12h5 M10 16h5 M15 3v5',
    upload: 'M12 16V3 m-5 5 5-5 5 5 M4 15v6h16v-6', arrow: 'M5 12h14 m-5-5 5 5-5 5',
    check: 'm5 12 4 4L19 6', message: 'M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4',
    shield: 'm12 3 9 4v6c0 5-9 9-9 9s-9-4-9-9V7z m-4 9 3 3 5-6', spark: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z',
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind] || paths.move}/></svg>
}

export function PrescriptionReview({ clinicianEmail }: { clinicianEmail?: string }) {
  const care = useCare()
  const [detail, setDetail] = useState(false)
  const [review, setReview] = useState('')
  const [confirm, setConfirm] = useState('')
  const clinicianConnections = clinicianEmail ? care.getConnectionsForClinician(clinicianEmail) : care.patientConnections
  const storedRequest = care.request
  const request = storedRequest && (!storedRequest.patientId || clinicianConnections.some(connection => connection.patientId === storedRequest.patientId)) ? storedRequest : null

  return <section className="card content-card">
    <div className="section-heading"><div><h3>Prescription Review</h3><p>Patient-submitted documents. Clinician-led decisions.</p></div><span className="badge amber">{request ? '1 submission' : 'No submissions'}</span></div>
    {!request ? <div className="empty-state"><Glyph kind="document" size={36}/><h3>No prescriptions awaiting review</h3><p>Once a patient submits a document or symptom description, it will appear here for review.</p></div> : <>
      <div className="queue-row"><span className="avatar">PT</span><div><h3>{request.patientName || 'Patient submission'}</h3><p>{request.patientId ? `${request.patientId} · ` : ''}{request.name} · {request.status}</p><small>{request.patientEmail || 'Patient-provided information'} · Not AI-approved</small></div><button className="button primary" onClick={() => { setDetail(v => !v); if (request.status === 'Submitted') care.setRequest({ ...request, status: 'Under Clinical Review' }) }}>Review submission</button></div>
      {detail && <div className="prescription-detail">
        {request.url && request.url !== '#' && <a className="button secondary" href={request.url} target="_blank" rel="noreferrer">Open document <Glyph kind="arrow" size={14}/></a>}
        <h3 className="spaced">Patient-provided information</h3><p>{request.notes || 'No additional information provided.'}</p>
        <label>Clinician review notes<textarea value={review} onChange={e => setReview(e.target.value)} placeholder="Add assessment, clarification or review notes…"/></label>
        <label>Clinician-defined plan<select value={care.plan} onChange={e => care.setPlan(e.target.value)}><option>Knee mobility · Phase 1</option><option>Lower limb strengthening · Phase 2</option><option>Shoulder mobility · Phase 1</option></select></label>
        <p className="report-note">Review the original prescription and clinical context before approving any plan. This demo does not generate medical decisions.</p>
        <div className="modal-actions">{['Clarification Required', 'Closed', 'Plan Ready'].map(status => <button key={status} className={'button ' + (status === 'Plan Ready' ? 'primary' : 'secondary')} disabled={!review.trim()} onClick={() => setConfirm(status)}>{status === 'Plan Ready' ? 'Approve defined plan' : status === 'Closed' ? 'Close with reason' : 'Request clarification'}</button>)}</div>
        {confirm && <div className="p-notice"><b>Confirm: {confirm}?</b><p>This action updates the demo review status only.</p><button className="button secondary" onClick={() => setConfirm('')}>Cancel</button> <button className="button primary" onClick={() => { care.setRequest({ ...request, status: confirm, review }); setConfirm(''); setDetail(false) }}>Confirm status change</button></div>}
      </div>}
    </>}
  </section>
}

export function ConnectedCarePanel({ page, clinicianEmail }: { page: string; clinicianEmail?: string }) {
  const care = useCare()
  const [text, setText] = useState('')
  const clinicianConnections = clinicianEmail ? care.getConnectionsForClinician(clinicianEmail) : care.patientConnections
  const connectedIds = new Set(clinicianConnections.map(connection => connection.patientId))
  const visibleSessions = care.sessions.filter(session => !!session.patientId && connectedIds.has(session.patientId))
  if (!['Sessions & Progress', 'Clinical Review Queue', 'Messages'].includes(page)) return null

  if (page === 'Messages') {
    const active = clinicianConnections.length > 0
    return <section className="card content-card"><div className="section-heading"><h3>Patient app · Connected demo data</h3><span className={'badge ' + (active ? 'green' : 'amber')}>{active ? 'Connected' : 'Not connected'}</span></div>
      {!active ? <p className="report-note">Messaging is unavailable until a patient connects using your physiotherapist code.</p> : <>
        <div className="connected-messages">{care.chat.length ? care.chat.map((message, i) => <div className="p-notice" key={i}><b>{message.role} · Demo message</b><p>{message.text}</p></div>) : <p className="report-note">No shared messages yet.</p>}</div>
        <form className="composer" onSubmit={e => { e.preventDefault(); if (text.trim()) { care.setChat(old => [...old, { text: text.trim(), role: 'Clinician' }]); setText('') } }}><input value={text} required onChange={e => setText(e.target.value)} placeholder="Reply to connected patient…"/><button className="button primary">Send demo reply</button></form>
      </>}
    </section>
  }

  return <section className="card content-card"><div className="section-heading"><div><h3>Patient app · Submitted session data</h3><p>Illustrative records; live movement analytics will be supplied by the backend.</p></div><span className="badge green">Demo data</span></div>
    {visibleSessions.length ? visibleSessions.map((session, i) => <div className="queue-row" key={`${session.patientId || 'patient'}-${session.exercise}-${i}`}><Glyph kind="move"/><div><h3>{session.patientName || 'Connected patient'} · {session.patientId || 'Patient ID pending'}</h3><p>{session.exercise} · {session.reps > 0 ? `${session.reps} repetitions` : 'Movement metrics pending backend connection'} · Patient-reported pain: {session.pain === null ? 'not provided' : `${session.pain}/10`}</p><small>Live rep count and quality will appear once the pose-estimation backend is integrated.</small></div><span className={'badge ' + (session.reviewed ? 'green' : 'amber')}>{session.reviewed ? 'Reviewed' : 'Needs review'}</span><button className="button secondary" disabled={session.reviewed} onClick={() => care.setSessions(old => old.map((s) => s.patientId === session.patientId && s.exercise === session.exercise ? { ...s, reviewed: true } : s))}>Mark reviewed</button></div>) : <p className="report-note">No session summaries from your connected patients yet. Ask a connected patient to submit their session summary.</p>}
  </section>
}

export function PatientConnectionsPanel({ page, clinicianEmail, clinicianCode }: { page: string; clinicianEmail: string; clinicianCode: string }) {
  const care = useCare()
  if (page !== 'Patient Connections') return null
  const connections = care.getConnectionsForClinician(clinicianEmail)
  return <div className="connection-page-stack">
    <section className="card content-card clinician-code-card">
      <div className="section-heading"><div><h3>Your patient connection code</h3><p>Share this code with a patient so they can connect from their Clinical Care menu.</p></div><span className="badge green">Active code</span></div>
      <div className="connection-code-value"><strong>{clinicianCode}</strong><button className="button secondary" onClick={() => { if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(clinicianCode) }}>Copy code</button></div>
      <p className="report-note">This demo uses a stable code derived from the signed-in email. Real code issuance, expiration and validation should be handled securely by the backend.</p>
    </section>
    <section className="card content-card"><div className="section-heading"><div><h3>Connected patients</h3><p>Patients who entered your code in this browser demo.</p></div><span className="badge green">{connections.length} connected</span></div>
      {connections.length ? connections.map(connection => <div className="queue-row patient-connection-row" key={connection.patientId}><span className="avatar">{connection.patientName.split(' ').map(part => part[0]).join('').slice(0,2).toUpperCase()}</span><div><h3>{connection.patientName}</h3><p><b>Patient ID: {connection.patientId}</b></p><small>{connection.patientEmail} · Connected {new Date(connection.connectedAt).toLocaleString()}</small></div><span className="badge green">{connection.status}</span></div>) : <div className="empty-state"><Glyph kind="shield" size={34}/><h3>No patients connected yet</h3><p>Once a patient enters your code, their name and unique Patient ID will appear here.</p></div>}
    </section>
  </div>
}
