# Online Donation Platform

Production-ready full-stack donation platform with public discovery pages, secure user flows, admin operations, Razorpay payments, audit visibility, and live donation progress updates.

## Overview

This repository contains:

- Frontend: multi-page interface for public users and admins
- Backend API: authentication, campaigns, donations, admin controls
- Payment integration: Razorpay order creation and signature verification
- Real-time updates: Socket.IO event emission after successful donations

## Tech Stack

### Frontend

- HTML5 (multi-page architecture)
- CSS3 (custom design system and responsive layout)
- Vanilla JavaScript (modular page scripts)

### Backend

- Node.js
- Express 5
- Mongoose (MongoDB ODM)
- JSON Web Token for authentication
- Razorpay SDK for payment workflows
- Socket.IO for real-time update events

### Security and Platform

- Helmet (security headers)
- CORS with allowed-origin controls
- express-rate-limit for API throttling
- cookie-parser
- Morgan for request logging

### Deployment

- Frontend hosting: Vercel
- Backend hosting: Render
- Database: MongoDB Atlas (recommended)

## Core Features

### 1. Authentication and Profile

- User registration and login
- JWT-based access control
- Protected profile fetch/update endpoints
- Blocked-user login prevention

### 2. Role-Based Admin Access

- Staff and role-restricted route guards
- Dedicated permissions for support, finance, admin, super admin
- Admin-only operational endpoints for users, campaigns, audit logs, and finance views

### 3. Campaign Management

- Public campaign listing with pagination and search
- Campaign detail endpoint
- Admin create, update, archive, and restore actions
- Campaign lifecycle states: active, paused, completed
- Raised-vs-goal consistency protection

### 4. Donation and Payment Flow

- Donation order creation per campaign
- Razorpay order generation
- Signature verification on callback data
- Payment status tracking: created, paid, failed
- Automatic campaign raisedAmount increment after successful payment
- Optional mark-failed flow for interrupted payments

### 5. Real-Time Donation Updates

- Backend emits donation updates through Socket.IO after successful payment verification
- Event payload includes campaign totals and payment status context

### 6. Admin Intelligence and Governance

- Dashboard stats (cached window)
- User management: list, block, unblock, archive, restore
- Donation monitoring and filtered admin views
- Audit log listing with pagination and filters
- Audit entries for sensitive operations

### 7. Frontend Experience

- Separate user and admin page sets
- Responsive UI layouts
- Structured client-side modules in assets js and css
- Enhanced onboarding, dashboard visibility, and admin operation UX

## Current Repository File Structure

```text
ODP - Copy/
├── index.html
├── README.md
├── vercel.json
├── backend/
│   ├── API_SMOKE_TEST.md
│   ├── package.json
│   ├── render.yaml
│   ├── smoke-test.http
│   └── src/
│       ├── app.js
│       ├── server.js
│       ├── config/
│       │   ├── db.js
│       │   └── razorpay.js
│       ├── controllers/
│       │   ├── adminController.js
│       │   ├── authController.js
│       │   ├── campaignController.js
│       │   └── donationController.js
│       ├── middleware/
│       │   ├── adminMiddleware.js
│       │   ├── asyncHandler.js
│       │   ├── authMiddleware.js
│       │   └── errorMiddleware.js
│       ├── models/
│       │   ├── AuditLog.js
│       │   ├── Campaign.js
│       │   ├── Donation.js
│       │   └── User.js
│       ├── routes/
│       │   ├── adminRoutes.js
│       │   ├── authRoutes.js
│       │   ├── campaignRoutes.js
│       │   ├── donationRoutes.js
│       │   └── index.js
│       ├── services/
│       ├── utils/
│       │   ├── AppError.js
│       │   ├── auditLogger.js
│       │   ├── corsOrigins.js
│       │   ├── generateToken.js
│       │   ├── seedAdmin.js
│       │   └── verifyRazorpaySignature.js
│       └── validators/
└── frontend/
	├── index.html
	├── REDESIGN_SUMMARY.md
	├── vercel.json
	├── public/
	└── src/
		├── api/
		├── assets/
		│   ├── css/
		│   │   ├── main.css
		│   │   └── main-old.css
		│   ├── images/
		│   └── js/
		│       ├── api.js
		│       ├── auth.js
		│       ├── config.js
		│       └── layout.js
		├── components/
		├── pages/
		│   ├── admin/
		│   │   ├── audit-logs.html
		│   │   ├── dashboard.html
		│   │   ├── donations-overview.html
		│   │   ├── login.html
		│   │   ├── manage-campaigns.html
		│   │   └── manage-users.html
		│   └── user/
		│       ├── campaign-details.html
		│       ├── campaigns.html
		│       ├── campaigns-old.html
		│       ├── dashboard.html
		│       ├── dashboard-old.html
		│       ├── donate.html
		│       ├── home.html
		│       ├── home-old.html
		│       ├── landing.html
		│       ├── login.html
		│       ├── profile.html
		│       ├── profile-old.html
		│       └── register.html
		└── utils/
```

## Key API Groups

- /api/auth
- /api/campaigns
- /api/donations
- /api/admin

## Local Setup

### Backend

1. Open terminal in backend
2. Install packages

```bash
npm install
```

3. Create .env and set required values
4. Start development server

```bash
npm run dev
```

5. Health check

```text
GET http://localhost:5000/health
```

### Frontend

Serve frontend as static files using Live Server or any HTTP static server.

Recommended entry page:

```text
frontend/src/pages/user/landing.html
```

## Backend Environment Variables

- NODE_ENV
- PORT
- MONGODB_URI
- JWT_SECRET
- JWT_EXPIRES_IN
- FRONTEND_URL
- RAZORPAY_KEY_ID
- RAZORPAY_KEY_SECRET
- DEFAULT_ADMIN_NAME
- DEFAULT_ADMIN_EMAIL
- DEFAULT_ADMIN_PASSWORD

## Deployment Notes

- Backend blueprint config: [backend/render.yaml](backend/render.yaml)
- Frontend routing config: [frontend/vercel.json](frontend/vercel.json)
- Frontend API base config: [frontend/src/assets/js/config.js](frontend/src/assets/js/config.js)

## Smoke Testing

- Test guide: [backend/API_SMOKE_TEST.md](backend/API_SMOKE_TEST.md)
- Request collection file: [backend/smoke-test.http](backend/smoke-test.http)
