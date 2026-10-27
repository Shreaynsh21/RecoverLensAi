import { FormEvent, useState } from 'react'
import { saveAuthToken, signIn, signUpPatient, type AuthenticatedUser } from './api'

import './login.css'
import recoverLensLogo from './assets/recoverlens-original-logo.png';



export type LoginRole = 'patient' | 'physiotherapist'

type LoginPageProps = {

  onLogin: (user: AuthenticatedUser) => void

}



function PersonIcon({ className }: { className?: string }) {

  return <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="9" r="5" stroke="currentColor" strokeWidth="2"/><path d="M6 27v-3a10 10 0 0 1 20 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>

}

function ClinicianIcon() {

  return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="13" cy="8" r="4.5" stroke="currentColor" strokeWidth="2"/><path d="M4.5 26v-3a8.5 8.5 0 0 1 17 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M24 12v9m-4.5-4.5h9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg>

}

function MailIcon() {

  return <svg className="field-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>

}

function LockIcon() {

  return <svg className="field-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.8"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="15" r="1.4" fill="currentColor"/></svg>

}

function EyeIcon({ visible }: { visible: boolean }) {

  return visible

    ? <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/></svg>

    : <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 8.5 5 9 7-.2.7-1 2-2.3 3.3M6.2 6.3C3.8 8 2.3 10.8 2 12c.5 2 3.8 7 10 7 1.1 0 2.1-.2 3-.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>

}



export default function LoginPage({ onLogin }: LoginPageProps) {

  const [role, setRole] = useState<LoginRole>('patient')

  const [displayName, setDisplayName] = useState('')

  const [displayNameError, setDisplayNameError] = useState('')

  const [email, setEmail] = useState('')

  const [password, setPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)

  const [rememberMe, setRememberMe] = useState(true)

  const [isSignup, setIsSignup] = useState(false)

  const [emailError, setEmailError] = useState('')

  const [passwordError, setPasswordError] = useState('')

  const [status, setStatus] = useState('')

  const [statusError, setStatusError] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)



  const clearFeedback = () => {

    setDisplayNameError('')

    setEmailError('')

    setPasswordError('')

    setStatus('')

    setStatusError(false)

  }

  const showStatus = (message: string, isError = false) => {

    setStatus(message)

    setStatusError(isError)

  }



  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearFeedback()
    let valid = true
    const cleanedEmail = email.trim().toLowerCase()
    const cleanedName = displayName.trim()

    if (isSignup && role !== 'patient') {
      showStatus('Physiotherapist accounts are provisioned by an administrator. Choose User Login to create a patient account.', true)
      return
    }
    if (isSignup && !cleanedName) {
      setDisplayNameError('Please enter your full name.')
      valid = false
    }
    if (!cleanedEmail) {
      setEmailError('Please enter your email address.')
      valid = false
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
      setEmailError('Please enter a valid email address.')
      valid = false
    }
    if (!password) {
      setPasswordError('Please enter your password.')
      valid = false
    } else if (isSignup && password.length < 16) {
      setPasswordError('Use at least 16 characters for a new account password.')
      valid = false
    }
    if (!valid) {
      showStatus('Please correct the highlighted fields.', true)
      return
    }

    setIsSubmitting(true)
    try {
      const result = isSignup
        ? await signUpPatient(cleanedName, cleanedEmail, password)
        : await signIn(cleanedEmail, password)
      const expectedRole = role === 'physiotherapist' ? 'clinician' : 'patient'
      if (result.user.role !== expectedRole) {
        throw new Error(
          result.user.role === 'clinician'
            ? 'This is a physiotherapist account. Select Physiotherapist Login and try again.'
            : 'This is a patient account. Select User Login and try again.',
        )
      }
      saveAuthToken(result.token, rememberMe)
      onLogin(result.user)
    } catch (error) {
      showStatus(error instanceof Error ? error.message : 'Sign-in failed. Please try again.', true)
    } finally {
      setIsSubmitting(false)
    }
  }


  return <main className="login-page">

    <div className="photo-backdrop" aria-hidden="true" />

    <div className="scene-overlay" aria-hidden="true" />



    <section className="brand-side" aria-label="RecoverLens AI introduction">

      <a className="logo-link" href="#" onClick={(e) => e.preventDefault()} aria-label="RecoverLens AI home">

        <img className="main-logo" src={recoverLensLogo} alt="RecoverLens AI — Rehabilitate, Track, Progress" />

      </a>



      <div className="brand-message">

        <p className="eyebrow"><span className="eyebrow-dot" /> PERSONALIZED REHABILITATION</p>

        <h1>Every movement<br />brings you <span>closer.</span></h1>

        <p className="brand-copy">Personalized rehabilitation. Guided progress.<br className="desktop-break" /> Connected care.</p>

        <div className="feature-row">

          <div className="feature-item"><span className="feature-icon"><PersonIcon /></span><strong>Personalized<br />plans</strong></div>

          <div className="feature-item"><span className="feature-icon"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 18l6-6 4 3 7-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M15 6h5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span><strong>Movement<br />tracking</strong></div>

          <div className="feature-item"><span className="feature-icon"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 13.8a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.7 1.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M14 10.2a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.9l1.7-1.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></span><strong>Connected<br />care</strong></div>

        </div>

      </div>

      <div className="brand-bottom-line"><span /><p>YOUR RECOVERY, CLEARLY IN FOCUS</p><span /></div>

    </section>



    <section className="login-side" aria-label="Sign in">

      <div className="login-card">

        <div className="card-heading">

          <div className="mobile-logo-wrap"><img src={recoverLensLogo} alt="RecoverLens AI" /></div>

          <h2 id="welcomeTitle">{isSignup ? 'Join RecoverLens AI' : 'Welcome to RecoverLens AI'}</h2>

          <p id="welcomeSubtitle">{isSignup ? `Create your ${role === 'patient' ? 'user' : 'physiotherapist'} account to get started.` : "Choose how you'd like to sign in."}</p>

        </div>



        <div className="role-grid" role="group" aria-label="Select login type">

          <button className={`role-card ${role === 'patient' ? 'selected' : ''}`} type="button" data-role="patient" aria-pressed={role === 'patient'} onClick={() => { setRole('patient'); clearFeedback() }}>

            <span className="role-card-icon patient-icon"><PersonIcon /></span>

            <span className="role-card-copy"><strong>User Login</strong><small>Continue your recovery journey</small></span>

            <span className="selected-mark">✓</span>

          </button>

          <button className={`role-card ${role === 'physiotherapist' ? 'selected' : ''}`} type="button" data-role="physiotherapist" aria-pressed={role === 'physiotherapist'} onClick={() => { setRole('physiotherapist'); clearFeedback() }}>

            <span className="role-card-icon clinician-icon"><ClinicianIcon /></span>

            <span className="role-card-copy"><strong>Physiotherapist Login</strong><small>Manage patients and review progress</small></span>

            <span className="selected-mark">✓</span>

          </button>

        </div>



        <form id="loginForm" noValidate onSubmit={handleSubmit}>

          {isSignup && role === 'patient' && <div className="field-group">
            <label htmlFor="displayName">Full name</label>
            <div className={`input-shell ${displayNameError ? 'invalid' : ''}`}>
              <PersonIcon className="field-icon" />
              <input id="displayName" name="displayName" type="text" placeholder="Your full name" autoComplete="name" required value={displayName} onChange={(e) => { setDisplayName(e.target.value); setDisplayNameError(''); setStatus('') }} />
            </div>
            <small className="field-error" id="displayNameError">{displayNameError}</small>
          </div>}

          <div className="field-group">

            <label htmlFor="email">Email address</label>

            <div className={`input-shell ${emailError ? 'invalid' : ''}`}>

              <MailIcon />

              <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="username" required value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(''); setStatus('') }} />

            </div>

            <small className="field-error" id="emailError">{emailError}</small>

          </div>



          <div className="field-group password-group">

            <label htmlFor="password">Password</label>

            <div className={`input-shell ${passwordError ? 'invalid' : ''}`}>

              <LockIcon />

              <input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" autoComplete={isSignup ? "new-password" : "current-password"} required minLength={isSignup ? 16 : 1} value={password} onChange={(e) => { setPassword(e.target.value); setPasswordError(''); setStatus('') }} />

              <button className="password-toggle" type="button" id="togglePassword" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(v => !v)}><EyeIcon visible={showPassword} /></button>

            </div>

            <small className="field-error" id="passwordError">{passwordError}</small>

          </div>



          <div className="form-meta">

            <label className="remember-control"><input id="rememberMe" type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} /><span className="custom-check">✓</span><span>Remember me</span></label>

            <button id="forgotPassword" type="button" className="text-button" onClick={() => { clearFeedback(); showStatus(email.trim() ? 'Password reset is not connected yet. Add a backend email-reset flow before launch.' : 'Enter your email address first to request a password reset.', !email.trim()) }}>Forgot password?</button>

          </div>



          <button className="submit-button" type="submit" disabled={isSubmitting}><span id="submitText">{isSubmitting ? 'Connecting securely…' : isSignup ? 'Create account' : role === 'patient' ? 'Sign In' : 'Sign In to Clinical Care'}</span><span className="submit-arrow" aria-hidden="true">→</span></button>

          <div className={`status-message ${status ? 'visible' : ''} ${statusError ? 'error' : ''}`} id="statusMessage" role="status" aria-live="polite">{status}</div>

        </form>



        <div className="signup-line"><span>{isSignup ? 'Already have an account?' : 'New to RecoverLens AI?'}</span><button id="createAccount" type="button" onClick={() => { setIsSignup(v => !v); clearFeedback() }}>{isSignup ? 'Back to sign in' : 'Create account'}</button></div>

        <p className="security-note"><span className="security-lock" aria-hidden="true">◆</span> Your information deserves privacy and care.</p>

      </div>

      <footer className="login-footer"><span>© 2026 RecoverLens AI</span><span>Rehabilitate · Track · Progress</span></footer>

    </section>

  </main>

}
