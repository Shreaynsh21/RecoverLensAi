# RecoverLens AI frontend integration notes

## Scope of this checkpoint

- Sign-in verifies email and password through `POST /auth/login`.
- Patient sign-up sends `display_name`, `email`, and `password` to `POST /auth/register`.
- The frontend fetches the signed-in account from `GET /auth/me`; add this endpoint to the FastAPI backend using `BACKEND_AUTH_ME_PATCH.md` from the integration bundle.
- A patient's dashboard identity comes from the backend's `patient_id`, not a fake browser-generated ID.
- Patient sign-up is public. Clinician/physiotherapist accounts remain provisioned by an administrator; a user cannot turn a patient account into a clinician account by choosing a UI role.
- Tokens are stored in `sessionStorage` unless “Remember me” is selected, in which case they are stored in `localStorage`. This is a practical prototype setup, not a substitute for a production security review.

## Important boundary

The current patient and clinical dashboard panels still contain prototype interactions and sample metrics in `PatientDashboard.tsx`, `ClinicalDashboard.tsx`, and `CareContext.tsx`. This checkpoint makes authentication backend-backed but does not yet claim that exercise sessions, prescription uploads, clinician review notes, messages, or charts are persisted through the API. Those flows must be wired against the actual response schemas next.

## Run locally

1. Install Node.js 20.19+ (the package uses Vite 8).
2. Copy `.env.example` to `.env` if you need a non-default API URL; do not put secrets in frontend environment variables.
3. From this directory run `npm ci`, then `npm run typecheck`, then `npm run build`, then `npm run dev`.
4. Start the FastAPI backend at `http://127.0.0.1:8000` and verify `GET /docs` loads.
5. Confirm the backend's CORS settings allow the frontend origin `http://localhost:5173`.
6. Add `GET /auth/me` to the API, run the backend tests, then test patient sign-up, patient login, invalid-password handling, clinician login, page refresh, and logout.

Do not commit `.env`, tokens, real patient records, uploaded prescriptions, `node_modules`, or `dist`.
