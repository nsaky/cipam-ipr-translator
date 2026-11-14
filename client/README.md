# CIPAM IPR Translator — Frontend (Part 1)

This is the frontend client for the **CIPAM IPR Translator**, developed using **React + Vite**. It implements **Part 1: Frontend Foundation & Authentication UI**, providing decoupled authentication routing, mock/real API drivers, and clean user interfaces designed for educational and government workflows.

---

## 1. Quick Start

### Prerequisites
- Node.js (v18 or v20+)
- npm

### Installation & Running Locally

1. Navigate to the client directory:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.

---

## 2. Default Routes & Credentials

| Route | Access | Description |
|---|---|---|
| `/login` | Public only | Official CIPAM login portal |
| `/register` | Public only | Account registration page |
| `/dashboard` | Protected | Dashboard placeholder (leads to Part 2 development) |

### Sample Credentials (Development Mock Mode)
- **Email:** `user@cipam.gov.in`
- **Password:** `Password123!`
*(Or click the "Fill Sample Credentials" quick-fill button on `/login`)*

You can also register a brand new account on `/register` — it will persist across page refreshes during your browser session.

---

## 3. Architecture & Backend Integration (Person A)

The frontend is architected to cleanly decouple UI components from backend implementation:

- **Central HTTP Client (`src/services/api.js`)**:
  - Uses Axios with `withCredentials: true` to support HTTP-only JWT cookies set by Person A's Express backend.
  - Base URL defaults to `http://localhost:5000` and is configurable via `VITE_API_URL`.

- **Authentication Service (`src/services/authService.js`)**:
  - Encapsulates `login()`, `register()`, `logout()`, and `getCurrentUser()`.
  - When `VITE_USE_MOCK_AUTH=true` (default), runs an in-memory / session storage mock driver. **No real JWT tokens are stored in localStorage/sessionStorage**, maintaining strict security boundaries.
  - When `VITE_USE_MOCK_AUTH=false`, communicates directly with Person A's backend endpoints:
    - `POST /auth/login`
    - `POST /auth/register`
    - `POST /auth/logout`
    - `GET /auth/me`

### How to Switch to Person A's Backend Later:
1. In `client/.env`:
   ```ini
   VITE_API_URL=http://localhost:5000
   VITE_USE_MOCK_AUTH=false
   ```
2. Restart the Vite dev server (`npm run dev`).
   No changes to UI or context code are required!
