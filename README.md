# TalentIQ

**TalentIQ** is an AI-powered Applicant Tracking System designed to help HR teams manage the complete recruitment lifecycle — from publishing jobs and receiving applications to AI-assisted CV screening, interviews, assessments, offers, and final hiring decisions.

TalentIQ combines recruitment workflow management with AI assistance while keeping hiring decisions under human control.

---

## Features

### Recruitment Management
- Create, edit, publish, close, and manage job openings
- Public careers page and job application flow
- Candidate CV upload and application tracking
- Dynamic hiring pipelines and configurable hiring stages
- Drag-and-drop and bulk pipeline movement
- Application history and stage transition tracking

### AI-Powered CV Screening
- AI-assisted CV evaluation using Groq
- Candidate-to-job matching
- Screening summaries and structured evaluation results
- Screening history stored for auditing
- AI assists HR without automatically making hiring decisions

### Interview Management
- Schedule and manage interviews
- Google Calendar integration
- Google Meet link generation
- Interview rescheduling and completion
- Interview feedback tracking

### Assessments
- Send external assessments to candidates
- Record assessment results
- Track assessment status
- Manual HR review before pipeline decisions

### Offers & Hiring
- Create and send job offers
- Secure candidate offer acceptance and rejection links
- Track offer status
- HR-controlled final hiring decision
- Accepted offers do not automatically mark candidates as hired

### Team & Company Management
- Company onboarding
- Admin and HR roles
- Secure team invitations
- Activate and deactivate team members
- Company-level data isolation

### Communication
- Recruitment email workflows
- Email activity tracking
- Candidate notifications
- Secure token-based candidate actions

### Dashboard & Analytics
- Recruitment dashboard
- Hiring activity overview
- Pipeline analytics
- Interview activity
- Job and application statistics

---

## Security

TalentIQ includes several security measures designed for a multi-company SaaS environment:

- JWT access and refresh authentication
- Role-based authorization
- Company-level tenant isolation
- Database-backed user status validation
- Secure invitation and offer-response tokens
- Hashed sensitive tokens
- Private CV storage
- Opaque public resource identifiers
- Raw MongoDB ObjectIds are not used in public URLs
- Soft-deletion support
- Input validation and protected API routes

---

## Public Resource IDs

TalentIQ separates internal MongoDB identifiers from externally exposed resource identifiers.

Example:

```text
job_a8f13c92e51b4f638dde79bf
app_...
int_...
offer_...
```

MongoDB `_id` values remain internal while public-facing routes use generated opaque identifiers.

---

## Tech Stack

### Frontend
- React
- TypeScript
- Tailwind CSS
- shadcn-style UI components
- Recharts

### Backend
- Node.js
- Express
- TypeScript
- REST API
- Mongoose

### Database & Storage
- MongoDB Atlas
- Cloudflare R2

### AI
- Groq API

### Integrations
- Google Calendar API
- Google Meet
- SMTP / Nodemailer

### Authentication & Security
- JWT authentication
- Refresh tokens
- Role-based access control
- Secure token workflows

### Development Tools
- Git
- GitHub
- Jest
- Swagger / OpenAPI
- Postman

---

## User Roles

### Admin
Administrators manage their company workspace, recruitment workflow, and HR team members.

### HR
HR users manage jobs, applications, AI screening, pipelines, interviews, assessments, emails, offers, and hiring decisions.

### Candidate
Candidates do not need a TalentIQ account. They interact through public job pages, application forms, email communication, and secure offer-response links.

---

## Project Structure

```text
TalentIQ/
│
├── backend/
│   ├── src/
│   ├── tests/
│   └── package.json
│
├── frontend/
│   ├── src/
│   └── package.json
│
└── README.md
```

---

## Running Locally

### 1. Clone the repository

```bash
git clone <repository-url>
cd TalentIQ
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Configure backend environment variables

Create your local `.env` file using the provided environment example.

Never commit API keys, passwords, JWT secrets, database credentials, or other sensitive values.

### 4. Start the backend

```bash
npm run dev
```

### 5. Install frontend dependencies

Open another terminal:

```bash
cd frontend
npm install
```

### 6. Start the frontend

```bash
npm run dev
```

Open the local frontend URL displayed by the development server.

---

## Testing

### Backend

```bash
cd backend
npm test
```

Current verified backend test suite:

```text
75 test suites passed
1580 tests passed
```

### Frontend

```bash
cd frontend
npm test
```

The project also includes TypeScript validation, linting, and production build checks.

---

## AI Decision Policy

TalentIQ uses AI as a recruitment assistant rather than an autonomous hiring system.

AI-generated screening results provide HR teams with additional information, but decisions such as advancing, rejecting, offering, or hiring candidates remain under human control.

---

## Data Privacy

Candidate CVs and sensitive recruitment information are handled through authenticated and company-scoped workflows.

Private files are stored separately from publicly accessible assets, and public candidate interactions use secure links instead of requiring candidate accounts.

---

## Product Goal

TalentIQ aims to provide a complete recruitment workspace where companies can manage hiring from the first job posting through the final hiring decision while combining structured workflows, secure data handling, automation, analytics, and responsible AI assistance.

---

## Author

**Mohamad Ali**

Full-Stack Developer