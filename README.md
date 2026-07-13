<div align="center">

# Rolebix Server

### Express and MongoDB API for the Rolebix job marketplace.

[![Live API](https://img.shields.io/badge/Live_API-Rolebix-7c3aed?style=for-the-badge)](https://rolebix-server-side.vercel.app)
[![Express](https://img.shields.io/badge/Express-5-black?style=for-the-badge&logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-47a248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)

**Backend Repository:** https://github.com/Tahaimage8/Rolebix-server-side  
**Frontend Repository:** https://github.com/Tahaimage8/Rolebix-client-side  
**Live API:** https://rolebix-server-side.vercel.app

</div>

---

## Overview

Rolebix Server is the REST API for the Rolebix career marketplace. It manages jobs, companies, user profiles, applications, recruiter workflows, administrator reports, plans, subscriptions, and Better Auth session verification.

The API is built with Express 5 and the native MongoDB Node.js driver.

## Main Capabilities

- MongoDB-backed REST API
- Better Auth session-token verification
- Role-based middleware for seekers, recruiters, and administrators
- Public job discovery
- Company management
- Seeker application history and details
- Recruiter applicant management
- Recruiter-owned job authorization
- Application status history
- Duplicate-application prevention
- Editable authenticated profile API
- Admin dashboard statistics
- Admin job moderation
- Admin payment history
- Subscription persistence
- Plan retrieval and filtering

## Technology Stack

| Area | Technology |
|---|---|
| Runtime | Node.js |
| Server | Express 5 |
| Database | MongoDB |
| Database driver | MongoDB Node.js Driver 7 |
| Configuration | dotenv |
| Cross-origin access | CORS |
| Module system | CommonJS |
| Deployment | Vercel-compatible Node.js service |

## Repository Structure

```text
Rolebix-server-side/
├── index.js
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

The current API is maintained in a single `index.js` file. As the project grows, it can be separated into routes, controllers, middleware, services, and validation modules.

## MongoDB Database

Database name:

```text
role
```

Collections used by the API:

| Collection | Purpose |
|---|---|
| `jobs` | Job listings |
| `companies` | Recruiter company profiles |
| `user` | Better Auth users and profile fields |
| `applications` | Job applications and status history |
| `plans` | Seeker and recruiter plan definitions |
| `subscription` | Payment and subscription records |
| `session` | Better Auth sessions |

## Authentication

Protected routes expect a Better Auth session token:

```http
Authorization: Bearer <session-token>
```

The server reads the token from the `session` collection, confirms that it is valid and not expired, loads the related user, and then applies role middleware where required.

Available role middleware:

- `verifyToken`
- `verifySeeker`
- `verifyRecruiter`
- `verifyAdmin`

## API Base URL

Local:

```text
http://localhost:5000
```

Production:

```text
https://rolebix-server-side.vercel.app
```

## API Endpoints

### Health

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/` | Public | Basic service response |

### Profile

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/profile` | Authenticated | Get the signed-in user's profile |
| PATCH | `/api/profile` | Authenticated | Update editable profile fields |

The profile update route does not allow users to change protected account fields such as email, role, or plan.

### Plans and subscriptions

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/plans` | Public | Get all plans or one plan with `plan_id` |
| POST | `/api/subscription` | Application flow | Save or update subscription data |

Example plan query:

```text
GET /api/plans?plan_id=seeker_growth
```

### Jobs

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/jobs` | Public | Paginated jobs with filters |
| GET | `/api/jobs/:id` | Public | Get one job |
| POST | `/api/jobs` | Recruiter workflow | Create a job |

Supported job-list filters include:

- `page`
- `limit`
- `search`
- `companyId`
- `company`
- `status`
- `category`
- `type`
- `experienceLevel`
- `workMode`

### Companies

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/companies` | Authenticated | Get companies with job counts |
| GET | `/api/my/companies` | Recruiter workflow | Get the recruiter's company |
| POST | `/api/companies` | Recruiter workflow | Create a company |
| PATCH | `/api/companies/:id` | Admin | Update company approval status |

### Applications

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/applications` | Seeker | Get the signed-in seeker's applications |
| GET | `/api/applications/:id` | Seeker | Get one owned application |
| POST | `/api/applications` | Application flow | Submit an application |
| GET | `/api/recruiter/applications` | Recruiter | Get applicants for company-owned jobs |
| PATCH | `/api/applications/:id/status` | Recruiter | Update an application status |

Supported application statuses:

```text
applied
reviewing
shortlisted
interview
hired
rejected
```

### Admin

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/admin/dashboard` | Admin | Platform statistics and recent activity |
| GET | `/api/admin/jobs` | Admin | Paginated moderation list |
| PATCH | `/api/admin/jobs/:id/status` | Admin | Update job moderation status |
| GET | `/api/admin/payments` | Admin | Payment history and revenue summary |

Admin job statuses:

```text
active
pending
paused
closed
rejected
```

### Statistics

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/stats` | Public | Aggregate job counts by type |

## Getting Started

### Prerequisites

- Node.js 20 or newer
- npm
- MongoDB database
- Rolebix client for the complete application

### Installation

```bash
git clone https://github.com/Tahaimage8/Rolebix-server-side.git
cd Rolebix-server-side
npm install
```

### Environment Variables

Create a `.env` file:

```env
MONGODB_URI=your_mongodb_connection_string
PORT=5000
```

Never commit `.env` or database credentials.

### Run Locally

```bash
npm start
```

The API will run at:

```text
http://localhost:5000
```

## Available Scripts

```bash
npm start
npm test
```

The current test script is a placeholder. Add automated API tests before a production release.

## Example Requests

### Get jobs

```bash
curl "http://localhost:5000/api/jobs?page=1&limit=9&status=active"
```

### Get a protected profile

```bash
curl "http://localhost:5000/api/profile" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### Update an application status

```bash
curl -X PATCH \
  "http://localhost:5000/api/applications/APPLICATION_ID/status" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"interview"}'
```

## Error Response Format

Most API errors use this structure:

```json
{
  "message": "Human-readable error message.",
  "error": "Optional development detail."
}
```

Common status codes:

| Status | Meaning |
|---|---|
| 200 | Successful request |
| 201 | Resource created |
| 400 | Invalid input |
| 401 | Missing or invalid session |
| 403 | Insufficient role or ownership |
| 404 | Resource not found |
| 409 | Duplicate application |
| 500 | Internal server error |

## Security and Production Checklist

Before a production release:

- Restrict CORS to trusted frontend domains.
- Ensure every mutation route has the correct role middleware.
- Validate and sanitize request bodies.
- Add request-rate limiting.
- Remove development error details from production responses.
- Add structured logging and monitoring.
- Store all secrets only in deployment environment variables.
- Add automated route and authorization tests.
- Add indexes for frequently queried MongoDB fields.

## Deployment

The server can be deployed as a Node.js service.

1. Import the repository into the deployment platform.
2. Add `MONGODB_URI`.
3. Set the production port when required by the platform.
4. Deploy.
5. Update the client's `NEXT_PUBLIC_BASE_URI`.

## Related Repository

Rolebix client:

```text
https://github.com/Tahaimage8/Rolebix-client-side
```

## Project Status

Rolebix is under active development. API structure, validation, test coverage, and authorization should continue to be hardened as new features are added.

## License

The repository currently uses the ISC package license. Review and update the license terms before public distribution or commercial reuse.

---

<div align="center">

Built with Express, MongoDB, and Node.js.

</div>