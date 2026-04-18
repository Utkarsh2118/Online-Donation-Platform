# Online Donation Platform

Full-stack donation platform with user and admin portals, JWT authentication, MongoDB storage, Razorpay payments, and real-time donation updates.

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- Database: MongoDB (Mongoose)
- Authentication: JWT
- Payment: Razorpay
- Real-time: Socket.io
- Deployment: Vercel (frontend), Render (backend)

## Project Structure

```text
ODP - Copy/
	backend/
		src/
			config/
			controllers/
			middleware/
			models/
			routes/
			services/
			utils/
			validators/
			app.js
			server.js
		.env.example
		package.json
		render.yaml

	frontend/
		src/
			assets/
				css/
				js/
			pages/
				user/
				admin/
		vercel.json
```

## 1. Local Setup

### Backend

1. Open terminal in `backend`.
2. Install dependencies:

```bash
npm install
```

3. Create `.env` from `.env.example` and set real values.
4. Start server:

```bash
npm run dev
```

5. Verify health endpoint:

```text
GET http://localhost:5000/health
```

### Frontend

Serve `frontend` using any static server, for example VS Code Live Server.

User landing page:

```text
frontend/src/pages/user/landing.html
```

## 2. Required Environment Variables (Backend)

Use these values in Render and local `.env`.

- `NODE_ENV` = `production` (or `development` locally)
- `PORT` = `5000` locally, Render injects its own runtime port
- `MONGODB_URI` = your MongoDB connection string
- `JWT_SECRET` = strong random secret
- `JWT_EXPIRES_IN` = `7d`
- `FRONTEND_URL` = deployed Vercel URL (example: `https://your-app.vercel.app`)
- `RAZORPAY_KEY_ID` = Razorpay public key id
- `RAZORPAY_KEY_SECRET` = Razorpay secret key
- `DEFAULT_ADMIN_NAME` = admin display name
- `DEFAULT_ADMIN_EMAIL` = initial admin email
- `DEFAULT_ADMIN_PASSWORD` = initial admin password

## 3. Deploy Backend on Render

### Option A: Blueprint (Recommended)

1. Push repository to GitHub.
2. In Render, create a new Blueprint and select the repository.
3. Render will detect [backend/render.yaml](backend/render.yaml).
4. Fill all `sync: false` environment variables.
5. Deploy.

### Option B: Manual Web Service

1. New Web Service in Render.
2. Configure:
	 - Root Directory: `backend`
	 - Build Command: `npm install`
	 - Start Command: `npm start`
3. Set environment variables listed above.
4. Deploy and verify:

```text
https://your-render-service.onrender.com/health
```

## 4. Deploy Frontend on Vercel

1. Push repository to GitHub.
2. Import project in Vercel.
3. Set **Root Directory** to `frontend`.
4. Framework preset: `Other`.
5. Vercel will use [frontend/vercel.json](frontend/vercel.json) for routing.
6. Deploy.

Important:

- Update backend `FRONTEND_URL` in Render to your Vercel domain.
- In [frontend/src/assets/js/config.js](frontend/src/assets/js/config.js), replace `https://your-backend-name.onrender.com/api` with your real Render API base URL.

## 5. Production Checklist

1. Confirm CORS works from Vercel domain to Render backend.
2. Confirm admin seed account is created once at first boot.
3. Test auth flow:
	 - register
	 - login
	 - role-based redirects
4. Test campaign flow:
	 - admin create/edit/delete
	 - user list/view
5. Test donation flow:
	 - create order
	 - Razorpay checkout
	 - backend signature verify
	 - campaign raised amount update
6. Test admin overview pages:
	 - users
	 - campaigns
	 - donations
7. Verify Socket event updates donation totals after successful payment.

## 6. Key API Groups

- `/api/auth`
- `/api/campaigns`
- `/api/donations`
- `/api/admin`

## 7. Notes

- Payments require valid Razorpay credentials.
- MongoDB Atlas is recommended for cloud deployment.
- If API returns 401/403 on deployed frontend, re-check token, role, and `FRONTEND_URL` CORS setting.

## 8. API Smoke Testing

- Quick runbook: [backend/API_SMOKE_TEST.md](backend/API_SMOKE_TEST.md)
- Executable request file: [backend/smoke-test.http](backend/smoke-test.http)
