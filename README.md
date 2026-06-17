# Rolebix Server Side

This is the backend API for Rolebix, a full-stack SaaS job marketplace platform for seekers, recruiters, and admins. The server provides REST API endpoints for jobs, companies, applications, plans, subscriptions, company approval, and platform stats.

## Live API

```txt
https://rolebix-server-side.vercel.app
```

Root endpoint:

```txt
GET /
```

Expected response:

```txt
Hello World!
```

## Client Repository

```txt
https://github.com/Tahaimage8/Rolebix-client-side
```

## Server Repository

```txt
https://github.com/Tahaimage8/Rolebix-server-side
```

## Project Overview

The Rolebix backend is responsible for:

* Connecting the platform to MongoDB.
* Serving public job data.
* Supporting server-side job pagination.
* Managing company registration data.
* Supporting admin company approval and rejection.
* Storing job applications.
* Serving subscription plan data.
* Saving subscription records after checkout.
* Providing dashboard stats.

## Tech Stack

* Node.js
* Express.js
* MongoDB
* CORS
* dotenv
* Vercel deployment

## Database

Database name:

```txt
role
```

Main collections used:

| Collection     | Purpose                                              |
| -------------- | ---------------------------------------------------- |
| `jobs`         | Stores job posts                                     |
| `companies`    | Stores recruiter company profiles                    |
| `user`         | Stores Better Auth user records and role/plan fields |
| `applications` | Stores job applications                              |
| `plans`        | Stores seeker and recruiter plan data                |
| `subscription` | Stores subscription and Stripe session data          |
| `session`      | Stores Better Auth session tokens                    |

## Environment Variables

Create a `.env` file in the server project root.

```env
MONGODB_URI=your_mongodb_connection_string
PORT=5000
```

For Vercel, add the same environment variables in the Vercel project settings.

## Installation

```bash
git clone https://github.com/Tahaimage8/Rolebix-server-side.git
cd Rolebix-server-side
npm install
```

## Local Development

Recommended script in `package.json`:

```json
{
  "scripts": {
    "start": "node index.js",
    "dev": "node index.js"
  }
}
```

Run locally:

```bash
npm run dev
```

Server will run on:

```txt
http://localhost:5000
```

## API Endpoints

### Health Check

```http
GET /
```

Returns a basic server response.

---

### Jobs

```http
GET /api/jobs
```

Returns paginated jobs.

Supported query parameters:

| Query             | Example           | Description               |
| ----------------- | ----------------- | ------------------------- |
| `page`            | `1`               | Current page number       |
| `limit`           | `9`               | Jobs per page             |
| `search`          | `developer`       | Search keyword            |
| `category`        | `web-development` | Filter by category        |
| `type`            | `full-time`       | Filter by job type        |
| `experienceLevel` | `mid`             | Filter by experience      |
| `workMode`        | `remote`          | Filter by work mode       |
| `company`         | `Google`          | Filter by company name    |
| `companyId`       | `company_id_here` | Filter jobs by company id |
| `status`          | `active`          | Filter jobs by job status |

Example:

```http
GET /api/jobs?page=1&limit=9
```

Response shape:

```json
{
  "jobs": [],
  "pagination": {
    "page": 1,
    "limit": 9,
    "totalJobs": 34,
    "totalPages": 4,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

---

### Job Details

```http
GET /api/jobs/:id
```

Returns one job by MongoDB ObjectId.

---

### Create Job

```http
POST /api/jobs
```

Creates a new job post.

Request body example:

```json
{
  "title": "Frontend Developer",
  "category": "web-development",
  "type": "full-time",
  "status": "active",
  "company": {
    "id": "company_id",
    "name": "Company Name"
  }
}
```

---

### Applications

```http
GET /api/applications
```

Returns job applications.

Supported query parameters:

| Query         | Description                                |
| ------------- | ------------------------------------------ |
| `applicantId` | Filter applications by seeker/applicant id |
| `jobId`       | Filter applications by job id              |

```http
POST /api/applications
```

Creates a new job application.

---

### Companies

```http
GET /api/companies
```

Returns company records with job counts.

```http
GET /api/my/companies?recruiterId=user_id
```

Returns a recruiter's company record.

```http
POST /api/companies
```

Creates a new company registration.

```http
PATCH /api/companies/:id
```

Updates company status.

Supported statuses:

```txt
pending
approved
rejected
```

This route is intended for admin company approval/rejection.

---

### Plans

```http
GET /api/plans
```

Returns all seeker and recruiter plans.

```http
GET /api/plans?plan_id=seeker_pro
```

Returns one plan by plan id.

---

### Subscriptions

```http
POST /api/subscription
```

Saves subscription/payment data and updates the user's plan.

Request body includes values such as:

```json
{
  "email": "user@example.com",
  "planId": "seeker_pro",
  "planName": "Pro",
  "stripeSessionId": "stripe_session_id",
  "paymentStatus": "paid",
  "amountTotal": 1900,
  "currency": "usd"
}
```

---

### Stats

```http
GET /api/stats
```

Returns job count grouped by job type/category-related fields for dashboard visualizations.

## Current Completion Status

### Completed

* Express server setup
* MongoDB connection
* Jobs API
* Server-side jobs pagination
* Job details API
* Job creation API
* Applications API
* Companies API
* Company approval/rejection endpoint
* Plans API
* Subscription save API
* Basic stats endpoint
* Vercel deployment

### In Progress / Planned

* Full role-based route protection
* Stronger validation middleware
* Admin payments API
* Admin users API through backend if needed
* Recruiter applicant status update API
* Email notification API
* Saved jobs API
* Resume upload API
* Payment history API
* Company public filtering API
* Centralized error handler
* Production CORS whitelist

## Deployment

The backend is deployed on Vercel.

Production API:

```txt
https://rolebix-server-side.vercel.app
```

Before deployment, make sure the following are configured:

* `MONGODB_URI`
* Production CORS origin if needed
* Vercel build/start settings

## Suggested Improvements

For a stronger production backend, the next phase should include:

* Separate route files instead of keeping everything in `index.js`.
* Controller/service structure.
* Request validation with Zod or Joi.
* Centralized error middleware.
* Proper CORS whitelist.
* Better Auth session verification hardening.
* API documentation with examples.
* More secure admin-only route handling.

## Notes for Reviewers

This backend supports the core data layer of Rolebix. It powers job listings, pagination, applications, companies, subscription records, plan retrieval, and company approval workflows. It is under active development and will be expanded with full admin, billing, applicant management, and notification features.
