# Public Appeal Service

A REST API for managing citizen appeals to government agencies - with AI-powered classification, role-based access control, and Redis caching.

Built as a demonstration of production-grade Node.js architecture using NestJS and TypeScript.

---

## What it does

Citizens submit appeals describing problems in their area — broken infrastructure, utility issues, healthcare concerns. The system automatically classifies each appeal by category and urgency using an LLM, routes it to the appropriate priority queue, and allows administrators to track and update resolution status.

The core idea is borrowed from a real operational challenge: government agencies receive thousands of unstructured text submissions and spend significant manual effort just sorting them before any actual work begins.

---

## Architecture

```text
src/
├── appeals/         # Core domain — CRUD, AI analysis, caching logic
│   ├── dto/         # Input validation
│   ├── entities/    # TypeORM schema
│   └── ...
├── auth/            # JWT authentication, role guards, decorators
│   ├── guards/
│   └── decorators/
├── users/           # User management, password hashing
├── ai/              # Groq LLM integration, prompt building, response validation
└── cache/           # Redis wrapper with safe fallback on connection failure
```

Each module is self-contained with explicit imports/exports. No circular dependencies.

---

## Tech stack

- **NestJS** — modular architecture with dependency injection
- **TypeScript** — strict typing throughout
- **PostgreSQL + TypeORM** — relational data with UUID primary keys
- **Redis (ioredis)** — response caching with TTL and manual invalidation
- **AI** — appeal classification and priority scoring
- **JWT + Passport** — stateless authentication
- **Jest** — unit tests with full mock isolation

---

## Key design decisions

**AI as an enhancement, not a dependency.** If the Groq API fails, the appeal is still saved with neutral default values. The system never rejects a citizen submission because of an AI timeout.

**Cache invalidation is explicit.** When an appeal is updated, both the individual appeal cache and the user's appeal list cache are invalidated together. This prevents stale reads without relying on TTL expiry alone.

**Password field is excluded at the ORM level.** The `password` column has `select: false` in the TypeORM entity — it's never accidentally included in query results unless explicitly requested via `addSelect`.

**Consistent error messages on auth failures.** Both "email not found" and "wrong password" return the same `Invalid credentials` response — the client learns nothing about which one failed.

---

## API endpoints

### Auth

| Method | Endpoint             | Description                    |
| ------ | -------------------- | ------------------------------ |
| POST   | `/api/auth/register` | Register a new citizen account |
| POST   | `/api/auth/login`    | Login and receive JWT token    |

### Appeals

| Method | Endpoint                  | Auth       | Description                        |
| ------ | ------------------------- | ---------- | ---------------------------------- |
| POST   | `/api/appeals`            | Citizen    | Submit a new appeal                |
| GET    | `/api/appeals/my`         | Citizen    | Get your own appeals               |
| GET    | `/api/appeals/:id`        | Citizen    | Get appeal by ID                   |
| GET    | `/api/appeals`            | Admin only | Get all appeals sorted by priority |
| PATCH  | `/api/appeals/:id/status` | Admin only | Update appeal status               |

---

## Running locally

You'll need PostgreSQL and Redis running locally, then:

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Fill in DB credentials, JWT secret, and Groq API key

# Start in development mode
npm run start:dev
```

---

## Example request

**Submit an appeal:**

```json
POST /api/appeals
Authorization: Bearer <token>

{
  "title": "Street lighting not working on Nizami street",
  "description": "The street lighting on Nizami street has not been working for three weeks. It creates safety issues for pedestrians after dark and has already caused one reported incident near the intersection."
}
```

**Response:**

```json
{
  "id": "e3f1a2b4-...",
  "title": "Street lighting not working on Nizami street",
  "status": "pending",
  "category": "infrastructure",
  "priority": "high",
  "aiAnalysis": {
    "reasoning": "Public safety issue affecting pedestrian infrastructure with documented incidents",
    "estimatedResolutionDays": 7,
    "analyzedAt": "2026-03-26T10:00:00.000Z"
  }
}
```

---

## Tests

```bash
npx jest --coverage
```

14 unit tests covering the service layer — cache hit/miss scenarios, access control, status transitions, and AI integration.
