# CIPAM IPR Translator — Frontend Application Reference

The **CIPAM IPR Translator** is a specialized, web-based productivity portal designed to translate Intellectual Property Rights (IPR) educational and legal materials from English into six major Indian languages:
**Hindi (`hi`)**, **Marathi (`mr`)**, **Bengali (`bn`)**, **Gujarati (`gu`)**, **Tamil (`ta`)**, and **Telugu (`te`)**.

The application accepts source documents (Word `.docx`, text-based `.pdf`, and `.png`/`.jpg`/`.jpeg` image flyers), manages multi-language translation pipelines, provides sentence-aligned bilingual inspection and sentence-level human editing/review, and supports publication-grade DOCX and PDF export alongside a standardized IPR terminology glossary.

---

## 1. Technology Stack

- **Framework & Runtime**: React 18 (Functional components with Hooks), Vite 5
- **Language**: JavaScript (ES6+ / JSX)
- **Routing**: React Router DOM v6
- **HTTP Client**: Axios with centralized error interceptors & `withCredentials: true`
- **Typography & Scripts**: Custom web fonts (`Plus Jakarta Sans`, `Noto Sans Devanagari`, `Noto Sans Bengali`, `Noto Sans Gujarati`, `Noto Sans Tamil`, `Noto Sans Telugu`)
- **Styling**: Pure semantic CSS with design-system custom properties (Light-mode only, zero heavy external UI libraries)

---

## 2. Frontend Features

### 2.1 Authentication & Sessions
- Dual-mode session handling: HTTP-only cookie JWT driver (real backend) and session-persisted mock driver.
- Route guards: `ProtectedRoute` (blocks unauthenticated visitors) and `PublicOnlyRoute` (redirects logged-in users away from `/login` and `/register`).
- Input validation, password visibility toggles, and sample credential quick-fill.

### 2.2 Dashboard & Document Management
- **Overview Dashboard**: Dynamically computes repository counts from live records: Total Documents, Recently Uploaded, Awaiting Translation, and Completed Translations.
- **Repository Listing**: Filterable by format (`PDF`, `DOCX`, `IMAGE`) and status (`UPLOADED`, `PENDING_REVIEW`, `COMPLETED`), searchable by name and author, sortable by upload date or title.
- **Document Ingestion**: Drag-and-drop file uploader with strict file validation (`≤ 10 MB`, `.docx`, `.pdf`, `.png`, `.jpg`, `.jpeg`) and clear callouts regarding scanned vs text-based PDFs.
- **Document Details**: Metadata inspector displaying file attributes, MIME type, description, and direct workflow shortcuts.

### 2.3 Language Selection & Translation Pipeline
- **Language Matrix**: Interactive cards covering the 6 target languages with native script previews, ISO codes, and descriptions.
- **Batch Translation**: Dispatches independent translation requests per language conforming to `POST /documents/:id/translate { "lang": "code" }`.
- **Live Progress**: Per-language status indicators (`Queued`, `Translating`, `Completed`, `Failed`) with independent retry controls.

### 2.4 Translation Results & Sentence Review
- **Bilingual Results**: Side-by-side sentence view paired 1-to-1 in strict original order with native script typography.
- **Sentence Review & Editing**:
  - Tri-pane interface: **Original English** (read-only), **Machine Translation** (read-only baseline), and **Final Translation** (human-editable).
  - Unsaved change tracking, inline save confirmation, and navigation protection modal.
  - Sentence-level **Approve** and **Reopen** actions; editing an approved sentence automatically clears approval.

### 2.5 Export & Download Workflow
- Formats supported: Microsoft Word (`.docx`) and Portable Document Format (`.pdf`).
- Dispatches `GET /documents/:id/export?lang=...&format=...` with binary blob handling and automatic download triggering.
- Warns users when attempting export with unapproved sentences.

### 2.6 IPR Terminology Glossary
- Comprehensive dictionary of official IPR concepts across English and all 6 Indian languages.
- Real-time search across English source terms, definitions, and regional script translations.
- Role-aware permissions: all authenticated users can browse and filter; administrators can add and delete entries.

---

## 3. Project Directory Structure

```text
client/
├── public/
├── src/
│   ├── config/
│   │   └── languages.js             # Centralized 6 target languages config, ISO codes, and script fonts
│   ├── context/
│   │   └── AuthContext.jsx          # User session, login, registration, logout, role evaluation
│   ├── components/
│   │   ├── MainLayout.jsx           # App shell: collapsible sidebar, responsive topbar, mobile drawer
│   │   ├── ProtectedRoute.jsx       # Route guards for public and authenticated routes
│   │   └── SentenceReviewCard.jsx   # Tri-pane sentence editing card with unsaved tracking & approval actions
│   ├── pages/
│   │   ├── Login.jsx                # Official CIPAM sign-in portal
│   │   ├── Register.jsx             # New user registration with password validation
│   │   ├── Dashboard.jsx            # Repository summary statistics and quick actions
│   │   ├── Documents.jsx            # Document repository table with search, filters, and sorting
│   │   ├── DocumentDetails.jsx      # Document metadata inspector and workflow entry point
│   │   ├── UploadDocument.jsx       # Drag-and-drop document upload interface
│   │   ├── LanguageSelection.jsx    # Target language selector with multi-select controls
│   │   ├── TranslationWorkflow.jsx  # Execution pipeline tracking per-language progress
│   │   ├── TranslationResults.jsx   # Bilingual aligned sentence comparison view
│   │   ├── TranslationReview.jsx    # Sentence-by-sentence review, editing, and approval workspace
│   │   ├── ExportDocument.jsx       # DOCX / PDF export interface with review validation
│   │   └── Glossary.jsx             # IPR terminology dictionary with admin controls
│   ├── services/
│   │   ├── api.js                   # Central Axios client with baseUrl and withCredentials: true
│   │   ├── authService.js           # Auth driver (mock vs real backend cookies)
│   │   ├── documentService.js       # Document repository driver (mock vs real endpoints)
│   │   ├── translationService.js    # Translation, review save, and approval driver
│   │   ├── exportService.js         # Binary DOCX/PDF export and download driver
│   │   └── glossaryService.js       # IPR terminology CRUD driver
│   ├── App.jsx                      # Route registry
│   ├── main.jsx                     # Application bootstrap
│   └── index.css                    # Unified design system and component styling
├── .env                             # Active environment configuration
├── .env.example                     # Environment template
├── index.html                       # HTML entry point with Indic Google fonts
├── package.json                     # Client dependencies
└── vite.config.js                   # Vite configuration
```

---

## 4. Application Routes

| Path | Access | Description |
|---|---|---|
| `/login` | Public only | User login screen |
| `/register` | Public only | User registration screen |
| `/dashboard` | Protected | Dashboard overview with repository statistics |
| `/documents` | Protected | Document repository with search, filter, and sorting |
| `/documents/:id` | Protected | Document metadata and details view |
| `/documents/:id/languages` | Protected | Language selection screen for translation |
| `/documents/:id/translate` | Protected | Multi-language translation pipeline progress |
| `/documents/:id/results` | Protected | Bilingual paired sentence results view |
| `/documents/:id/review` | Protected | Sentence-by-sentence editing and approval interface |
| `/documents/:id/export` | Protected | DOCX and PDF export selection and download |
| `/upload` | Protected | Document ingestion screen |
| `/glossary` | Protected | IPR terminology dictionary (Admin add/delete) |

---

## 5. API Contract Reference

The frontend is architected to interact with Person A's Express / PostgreSQL backend and Person B's processing services through the following REST endpoints:

### 5.1 Authentication
- `POST /auth/register` — Body: `{ name, email, password }`
- `POST /auth/login` — Body: `{ email, password }`
- `POST /auth/logout` — Clears server-side HTTP-only session cookie
- `GET /auth/me` — Returns current authenticated user `{ id, name, email, role }`

### 5.2 Documents
- `POST /documents` — Multipart `FormData` containing `document` file and optional `description`
- `GET /documents` — Returns array of documents `[ { id, name, fileType, fileSize, uploadDate, status } ]`
- `GET /documents/:id` — Returns single document metadata

### 5.3 Translation
- `POST /documents/:id/translate` — Body: `{ "lang": "hi" }` *(Accepts exactly one language code per request)*
- `GET /documents/:id/translations?lang=hi` — Returns sentence records for the specified language

### 5.4 Sentence Review & Approval
- `PATCH /translations/:id` — Updates individual sentence record:
  - To save human edits: `{ "final_text": "Updated sentence text" }`
  - To update approval: `{ "approved": true }` or `{ "approved": false }`

### 5.5 Export
- `GET /documents/:id/export?lang=hi&format=docx`
- `GET /documents/:id/export?lang=ta&format=pdf`
- Must return raw binary file with `Content-Disposition: attachment; filename="..."`

### 5.6 Glossary
- `GET /glossary` — Returns all glossary entries
- `POST /glossary` — Admin only. Body: `{ term, category, definition, translations: { hi, mr, bn, gu, ta, te } }`
- `DELETE /glossary` — Admin only. Query / body: `{ id, term }`

---

## 6. Frontend Normalized Data Structures

### Document Object
```json
{
  "id": "doc_101",
  "name": "Patents_Filing_Guidelines.docx",
  "fileType": "docx",
  "fileSize": 1548288,
  "uploadDate": "2026-11-12T14:30:00.000Z",
  "status": "COMPLETED",
  "uploadedBy": "Dr. Rajesh Kumar",
  "description": "Procedure for filing patent applications under expedited examination."
}
```

### Sentence / Translation Review Record
```json
{
  "id": "trans_doc_101_hi_1",
  "sentenceNumber": 1,
  "original_text": "Intellectual property refers to creations of the mind.",
  "machine_text": "बौद्धिक संपदा मन की रचनाओं को संदर्भित करती है।",
  "final_text": "बौद्धिक संपदा मन की रचनाओं को संदर्भित करती है।",
  "approved": true
}
```

### Glossary Entry
```json
{
  "id": "glo_2",
  "term": "Patent",
  "category": "Industrial Property",
  "definition": "Exclusive legal right granted for an invention for a limited period.",
  "translations": {
    "hi": "पेटेंट",
    "mr": "पेटंट",
    "bn": "পেটেন্ট",
    "gu": "પેટન્ટ",
    "ta": "காப்புரிமை",
    "te": "పేటెంట్"
  },
  "createdBy": "CIPAM Admin"
}
```

---

## 7. Environment Configuration

Template available in `client/.env.example`:

```ini
# Backend API Base URL
VITE_API_URL=http://localhost:5000

# Set to 'false' to connect to live backend services
VITE_USE_MOCK_AUTH=true
VITE_USE_MOCK_DOCUMENTS=true
VITE_USE_MOCK_TRANSLATIONS=true
VITE_USE_MOCK_EXPORTS=true
VITE_USE_MOCK_GLOSSARY=true
```

To run against Person A's backend, simply set `VITE_USE_MOCK_*=false` and provide the live `VITE_API_URL`.

---

## 8. Installation & Local Development

1. Navigate to the client directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   ```

---

## 9. Backend Integration Guide (Person A & Person B)

1. **CORS & Cookies**: Person A's Express app must allow credentials from the client origin:
   ```javascript
   app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
   ```
2. **Stable Sentence IDs**: When sentences are split and translated, each sentence in the database must have a stable, unique primary key so that `PATCH /translations/:id` can update `final_text` or `approved` without ambiguity.
3. **Preserve Baseline Translation**: Store `machine_text` separately from `final_text` in the PostgreSQL database so human revisions never overwrite the original machine translation.
4. **Binary Export**: The export endpoint must send raw binary buffers (generated via Person B's `exportDocx` / `exportPdf`) with appropriate MIME headers (`application/vnd.openxmlformats-officedocument.wordprocessingml.document` or `application/pdf`).
5. **Admin Authorization**: While the frontend conditionally hides Add/Delete actions based on the session `role`, Person A's backend must verify session JWTs and return `403 Forbidden` for unauthorized requests to `POST /glossary` and `DELETE /glossary`.
