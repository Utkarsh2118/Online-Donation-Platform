# API Smoke Test Checklist

This checklist validates all major API flows quickly.

## Pre-Run Setup

1. Create `backend/.env` from `backend/.env.example`.
2. Set valid values for:
- `MONGODB_URI`
- `JWT_SECRET`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
3. Start backend:

```bash
cd backend
npm run dev
```

4. Verify health endpoint:

```bash
curl http://localhost:5000/health
```

Expected: `200` with `success: true`.

## Recommended Execution Order

Use [backend/smoke-test.http](backend/smoke-test.http) in VS Code REST Client (or copy requests into Postman).

Run this sequence:

1. Health
2. Register user
3. Login user
4. Seed admin
5. Login admin
6. Create campaign (admin)
7. List campaigns
8. Campaign details
9. User profile
10. Create donation order
11. Verify payment (real Razorpay only)
12. Mark failed payment (optional)
13. User donation history
14. Campaign donation feed
15. Admin dashboard
16. Admin users list
17. Admin donations overview
18. Update campaign
19. Delete campaign

## Pass Criteria by Area

### Auth
- Register returns token and user object.
- User login returns role `user`.
- Admin login returns role `admin`.
- `/api/auth/me` works only with valid token.

### Campaigns
- Admin can create/update/delete campaigns.
- Public can list active campaigns.
- Campaign details returns selected campaign.

### Donations and Payment
- Donation create returns donation + Razorpay order + key id.
- Verify payment marks donation `paid` and increments campaign `raisedAmount`.
- Failed payment marks donation `failed`.

### Admin
- `/api/admin/*` rejects non-admin tokens.
- Dashboard/users/donations endpoints return paginated data.

## Common Failure Checks

- `401 Unauthorized`: missing/invalid token.
- `403 Forbidden`: user lacks admin role or account blocked.
- `400 Payment signature verification failed`: invalid Razorpay signature.
- `500 Razorpay keys are not configured`: missing Razorpay env values.
- CORS errors: `FRONTEND_URL` mismatch with deployed frontend domain.
