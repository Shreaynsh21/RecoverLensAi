import { useEffect, useState } from 'react'
import LoginPage from './LoginPage'
import PatientDashboard from './PatientDashboard'
import ClinicalDashboard from './ClinicalDashboard'
import {
  clearAuthToken,
  getAuthToken,
  getCurrentUser,
  nameFromEmail,
  type AuthenticatedUser,
} from './api'
import { CareProvider, useCare, type PrescriptionRequest } from './CareContext'
import './global.css'
import './clinical.css'

function AppShell() {
  const care = useCare()
  const [authUser, setAuthUser] = useState<AuthenticatedUser | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      setAuthReady(true)
      return
    }

    let active = true
    getCurrentUser(token)
      .then((user) => {
        if (user.role === 'patient' && !user.patient_id) {
          throw new Error('This patient account is not linked to a patient record.')
        }
        if (active) setAuthUser(user)
      })
      .catch(() => {
        clearAuthToken()
      })
      .finally(() => {
        if (active) setAuthReady(true)
      })

    return () => {
      active = false
    }
  }, [])

  // The local connection code is retained only for the existing prototype UI.
  // Authentication and patient identity now come from the backend.
  useEffect(() => {
    if (authUser?.role === 'clinician') care.registerClinician(authUser.email)
  }, [authUser?.email, authUser?.role])

  const handleLogout = () => {
    clearAuthToken()
    setAuthUser(null)
  }

  if (!authReady) {
    return <main className="auth-loading" role="status" aria-live="polite">Restoring your secure session…</main>
  }

  if (!authUser) return <LoginPage onLogin={setAuthUser} />

  if (authUser.role === 'patient') {
    const identity = {
      id: String(authUser.patient_id),
      name: authUser.display_name?.trim() || nameFromEmail(authUser.email),
      email: authUser.email,
    }
    const connection = care.getConnectionForPatient(identity.id)
    return (
      <div className="active-app" data-current-user={identity.email}>
        <PatientDashboard
          onLogout={handleLogout}
          patientId={identity.id}
          patientName={identity.name}
          patientEmail={identity.email}
          connectedClinician={connection}
          onConnectClinician={(code) => care.connectPatientToClinician(identity, code)}
          onPrescriptionSubmitted={(request: Omit<PrescriptionRequest, 'status' | 'review'>) =>
            care.setRequest({
              ...request,
              patientId: identity.id,
              patientName: identity.name,
              patientEmail: identity.email,
              status: 'Submitted',
              review: '',
            })
          }
        />
      </div>
    )
  }

  return (
    <div className="clinical-root" data-current-user={authUser.email}>
      <ClinicalDashboard
        onLogout={handleLogout}
        clinicianEmail={authUser.email}
      />
    </div>
  )
}

export default function App() {
  return (
    <CareProvider>
      <AppShell />
    </CareProvider>
  )
}
