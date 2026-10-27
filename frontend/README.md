# RecoverLens AI — Combined Frontend

This project combines the supplied RecoverLens AI patient dashboard, physiotherapist dashboard, and photo-backed login page into one React + Vite application.

## Run locally

Requirements: Node.js 20.19+ (Node.js 22 recommended).

1. Open this folder in VS Code.
2. Open **Terminal → New Terminal**.
3. Run:

   ```bash
   npm install
   npm run dev
   ```

4. Open the localhost URL shown by Vite (typically `http://localhost:5173`).

Useful checks:

```bash
npm run typecheck
npm run build
```

## Demo flow

- Login is the initial screen.
- Select **User Login** or **Physiotherapist Login**.
- Enter a valid-shaped email and a password of at least six characters.
- The app opens the selected dashboard.
- Patient prescription/session submissions are shared with the clinical review panel through React context for the current app session.
- Use **Sign out** to return to login.

## Limitations

This is a frontend hackathon prototype. The current sign-in checks form fields and routes according to the selected role; it does not verify credentials with a server. Passwords are not stored. Real authentication and role authorization require a backend.

Patient assessment, camera movement values, exercise quality, and some clinician data are demo/simulated values. The shared prescription and session context is in memory only and is cleared on sign out; it does not persist across reloads. Real pose estimation, data persistence, secure messaging, and clinical APIs are not connected.
