# LifeReceipt
**AI-Powered Digital Ownership Intelligence Platform**

*An enterprise-grade, multi-tenant digital ownership intelligence platform that transforms fragmented paper receipts, tax invoices, warranties, service histories, and product manuals into a cryptographically secured, living digital ownership record.*

---

## 1. Problem Statement

Every consumer and enterprise regularly purchases high-value hardware, appliances, electronics, and vehicles. However, critical post-purchase ownership documentation is completely fragmented:
- **Scattered Receipts & Invoices**: Invoices are buried in email threads, thermal paper slips that fade, physical file folders, or lost entirely.
- **Lapsed Warranties & Missed Return Windows**: Owners lose track of statutory return periods and manufacturer warranty deadlines, leading to unexpected out-of-pocket expenses.
- **Opaque Service & Repair Histories**: When hardware breaks down, owners cannot easily locate verified authorized service centers, lack documented proof of prior repairs, and lose warranty claims due to missing purchase invoices.
- **Friction in Resale & Secondary Transfers**: Proving authentic provenance, genuine ownership, clean service history, and transferable warranty during peer-to-peer sales is nearly impossible without a single source of truth.

---

## 2. The LifeReceipt Solution

**LifeReceipt** permanently eliminates physical and digital ownership fragmentation. By combining multi-modal AI document intelligence (Google Gemini 1.5 Flash), automated Indian tax parsing (GSTIN, CGST, SGST, INR `₹`), proactive warranty lifecycle calculations, authoritative manufacturer integrations, and cryptographically signed **Digital Ownership Passports**, LifeReceipt converts static purchase slips into actionable ownership intelligence.

---

## 3. Key Platform Features

| Feature Area | Capabilities & Innovations |
|---|---|
| **AI Document Intelligence** | Multi-page PDF & image processing, SHA-256 binary file hashing, magic byte file validation, Indian GSTIN extraction, confidence scoring, duplicate document prevention, and automated product-document matching with conflict detection. |
| **Physical Asset Ownership** | Multi-category product inventory (Electronics, Appliances, Computing, Automotive, etc.), serial number auditing, purchase price baselines in INR (`₹`), seller details, and lifecycle stage tracking. |
| **Dynamic Warranty & Return Tracking** | Automated status calculations (`ACTIVE`, `EXPIRING_SOON`, `EXPIRED`, `RETURN_ACTIVE`, `RETURN_EXPIRING_SOON`), real-time notification alerts with idempotency, and statutory return deadline monitors. |
| **AI Ownership Assistant** | Context-grounded conversational assistant powered by Google Gemini with strict 4-way source attribution (`DATABASE`, `DOCUMENT`, `OFFICIAL_WEB`, `AI_INTERPRETATION`). Answers catalog queries, warranty terms, repair histories, spend totals, verified service centers, and warranty claim steps without hallucination. |
| **Service & Repair Ecosystem** | Comprehensive repair tracking with automated pattern detection (`FREQUENT_REPAIRS`, `HIGH_REPAIR_BURDEN`, `RECURRING_DEFECT`), automatic repair expense synchronization, turnaround duration analytics, and an authoritative 8-metro Indian service center directory. |
| **Warranty Claim Hub** | One-click claim document preparation, pre-flight checklist verification, and direct claim submission tracking. |
| **Digital Ownership Passport** | Unified cryptographic asset passport with permissioned sharing tiers (`BASIC`, `DETAILED`, `FULL`), dynamic QR codes, instant share revocation, and downloadable PDF passports via PDFKit. |
| **Peer-to-Peer Ownership Transfer** | Cryptographic handoff workflow (`INITIATED`, `ACCEPTED`, `REJECTED`, `CANCELLED`) transferring verified ownership while safely retaining immutable historical audit trails. |
| **Email Receipt Intelligence** | OAuth2 email provider integration (Gmail `gmail.readonly`, Outlook `Mail.Read`) with AES-256-GCM token encryption, purchase invoice discovery, and structured confirmation review. |
| **Authoritative Manufacturer Intelligence** | Priority 1 manufacturer specifications, customer care helplines, official user guides/manuals, and side-by-side warranty duration conflict detection (HP, Apple, Samsung, Sony, Dell, Lenovo, LG, OnePlus, Asus). |
| **Total Cost of Ownership (TCO)** | Cumulative cost analytics covering purchase price, repair costs, maintenance, and accessories in Indian Rupees (`₹`). |
| **Mobile & PWA Experience** | Installable Progressive Web App (PWA) with standalone display mode, `sw.js` shell caching with **strict non-API bypass**, $\ge 44\text{px}$ touch targets, bottom navigation, and direct camera receipt scanning. |
| **Privacy & Security Architecture** | Strict multi-tenant data isolation, tamper-evident 90-day security audit logging, bcrypt password hashing, NoSQL injection neutralization, and zero credential leakage. |

---

## 4. Technology Stack

### Frontend
- **Framework**: React 18 (SPA) with Vite
- **Routing**: React Router v6
- **Styling**: Tailwind CSS, PostCSS, Lucide React Icons
- **PWA**: Web App Manifest (`manifest.json`), Custom Service Worker (`sw.js`)
- **HTTP Client**: Axios with centralized JWT Bearer interceptor
- **Performance**: Rollup manual chunk vendor splitting (`vendor-react`, `vendor-icons`, `vendor-utils`)

### Backend
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js (RESTful API versioned under `/api/v1`)
- **Database Engine**: MongoDB with Mongoose ODM
- **Document Processing**: `pdf-parse`, `pdfkit`
- **Security & Cryptography**: JWT (`jsonwebtoken`), `bcryptjs`, `crypto` (AES-256-GCM, SHA-256), `helmet`, `cors`, `express-rate-limit`

### AI & Regional Intelligence
- **AI Provider**: Google Gemini 1.5 Flash (Multi-Modal Vision & Text)
- **Regional Engine**: India-First (`INR`, `₹`, `en-IN`, Indian Numbering System e.g., `₹1,25,000`, GSTIN / CGST / SGST extraction)

---

## 5. System Architecture

```
                                  [ User Client ]
                     (Desktop Browser / Mobile PWA / Tablet)
                                        │
                                        │ HTTPS / WSS
                                        ▼
                           ┌─────────────────────────┐
                           │   React 18 + Vite SPA   │
                           │  • Tailwind CSS         │
                           │  • Service Worker Cache │
                           │  • Bottom Nav / Camera  │
                           └────────────┬────────────┘
                                        │
                       REST API (/api/v1) + JWT Bearer
                                        │
                                        ▼
                           ┌─────────────────────────┐
                           │   Express.js API Engine │
                           │  • Helmet & CORS        │
                           │  • NoSQL Sanitizer      │
                           │  • Param Validators     │
                           │  • Rate Limiters        │
                           └────────────┬────────────┘
                                        │
            ┌───────────────────────────┼───────────────────────────┐
            │                           │                           │
            ▼                           ▼                           ▼
┌───────────────────────┐   ┌───────────────────────┐   ┌───────────────────────┐
│     MongoDB Atlas     │   │   Google Gemini API   │   │  External Integrations│
│ • User Isolation      │   │ • Multi-modal Vision  │   │ • Manufacturer Specs  │
│ • Compound Indexes    │   │ • 1.5 Flash Reasoning │   │ • Service Center Hubs │
│ • 90d Audit Logs      │   │ • Zero Hallucination  │   │ • Gmail / Outlook     │
└───────────────────────┘   └───────────────────────┘   └───────────────────────┘
```

---

## 6. Quick Start & Local Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ / v24+ supported)
- **npm**: v9.0.0 or higher
- **MongoDB**: Local MongoDB instance running on `127.0.0.1:27017` (or MongoDB Atlas connection string)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-org/lifereceipt.git
cd lifereceipt

# Install both backend and frontend dependencies
npm run install:all
```

### 2. Configure Backend Environment
Create `backend/.env` based on `backend/.env.example`:
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your local settings:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/lifereceipt
CLIENT_URL=http://localhost:5173

# Authentication
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# File Storage
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760

# AI Configuration (Gemini)
AI_PROVIDER=GEMINI
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Configure Frontend Environment
Create `frontend/.env` based on `frontend/.env.example`:
```bash
cp frontend/.env.example frontend/.env
```

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_APP_NAME=LifeReceipt
```

### 4. Run the Development Servers
In two separate terminals:

```bash
# Terminal 1: Backend Server
cd backend
npm run dev
# Starts on http://localhost:5000

# Terminal 2: Frontend Client
cd frontend
npm run dev
# Starts on http://localhost:5173
```

---

## 7. End-to-End User Journey (Flows A–I)

```
[ FLOW A: Registration & Dashboard ]
   Register -> Sign in -> View Empty State Dashboard -> Add Purchase -> Real-time Aggregation

[ FLOW B: Receipt to Ownership ]
   Upload PDF/Image -> Magic Byte & SHA-256 Check -> Gemini Extraction -> GSTIN Parsing
   -> User Review Modal -> Confirm Product -> Asset Created + Document Linked

[ FLOW C: Warranty & Claim Preparation ]
   Product Detail -> Dynamic Status (ACTIVE / EXPIRING) -> Alert Generated -> Prepare Claim
   -> Required Documents Check -> Submit Claim

[ FLOW D: Service & Repair Ecosystem ]
   Log Service Request -> Status Pipeline -> Actual Cost Syncs to Expenses -> Pattern Detection
   (Repeated repairs / High burden) -> Locate Authorized Metro Centers

[ FLOW E: AI Assistant Grounding ]
   Ask Assistant ("What products do I own?", "Where can I service my laptop?", "Warranty terms?")
   -> Multi-source verified response with strict zero-hallucination policy

[ FLOW F: Email Receipt Inbox ]
   Connect Provider -> High-signal purchase scan -> Duplicate detection -> Confirm to Ledger

[ FLOW G: Ownership Transfer ]
   Initiate Transfer -> Cryptographic Handshake -> Recipient Accepts -> Ownership Transferred
   -> Historical Audit Preserved

[ FLOW H: Digital Passport & Sharing ]
   Product Passport -> Generate Cryptographic Share -> Set Expiry & Tier -> View Public Page
   -> QR Code -> Instant Revocation

[ FLOW I: Mobile & PWA ]
   Install App -> Bottom Navigation -> Camera Receipt Scan -> Offline Fallback
```

---

## 8. Security & Privacy Guarantees

1. **Strict Multi-Tenant Isolation**: Every database query scopes strictly by `userId: req.user._id`. Users cannot view, modify, or delete another user's assets.
2. **Zero Plaintext Secrets**: Passwords hashed with bcrypt (salt rounds: 10). Email OAuth refresh tokens encrypted with authenticated AES-256-GCM.
3. **Magic Byte File Inspection**: Uploaded documents are validated by signature headers (PDF `%PDF`, JPEG `\xFF\xD8`, PNG `\x89PNG`), blocking disguised executables.
4. **Tamper-Evident Audit Logging**: Comprehensive security event recording (`LOGIN`, `REGISTER`, `DOCUMENT_UPLOAD`, `PASSPORT_SHARE_CREATE`, `PASSPORT_SHARE_REVOKE`, `TRANSFER_INITIATE`, `TRANSFER_ACCEPT`) with automated 90-day TTL rolling expiration.
5. **PWA Non-Credentialed Cache Guarantee**: The Service Worker explicitly bypasses `/api/*` and `/uploads/*`, ensuring authentication tokens and sensitive ownership data are never stored in client browser caches.

---

## 9. Verification & Automated Test Suites

LifeReceipt includes automated verification suites covering every functional layer:

```bash
# 1. Regional Formatting, Dynamic Calculators & Alert Idempotency
node scratch/verify_phase4.js

# 2. Privacy, Security, Document Intelligence & IDOR Suite
node scratch/verify_phase15_16.js

# 3. Service Ecosystem, Pattern Detection & PWA Assets Suite
node scratch/verify_phase17_18.js

# 4. Master Phase 19 End-to-End Integration Suite
node scratch/verify_phase19_e2e.js

# 5. Production Frontend Build Validation
npm run frontend:build
```

---

## 10. License & Submission
LifeReceipt is built for hackathon evaluation and long-term production scalability. All code, schemas, and assets are strictly proprietary to the LifeReceipt team.
