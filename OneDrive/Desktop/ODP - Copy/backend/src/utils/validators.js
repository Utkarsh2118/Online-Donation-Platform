const { z } = require('zod');

// ── Reusable primitives ────────────────────────────────────────────────────
const emailSchema = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .email('Please provide a valid email address');

const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const nameSchema = z
  .string({ required_error: 'Name is required' })
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(60, 'Name cannot exceed 60 characters');

// ── Auth schemas ───────────────────────────────────────────────────────────
const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required')
});

const forgotPasswordSchema = z.object({ email: emailSchema });

const resetPasswordSchema = z.object({
  token: z.string({ required_error: 'Reset token is required' }).min(1),
  email: emailSchema,
  password: passwordSchema
});

const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  mobileNumber: z.string().trim().max(20).optional(),
  profilePicture: z.string().trim().url('Must be a valid URL').optional()
}).refine(data => Object.keys(data).length > 0, { message: 'No valid fields provided for update' });

// ── Campaign schemas ───────────────────────────────────────────────────────
const createCampaignSchema = z.object({
  title: z.string().trim().min(5, 'Title must be at least 5 characters').max(120, 'Title cannot exceed 120 characters'),
  description: z.string().trim().min(20, 'Description must be at least 20 characters'),
  goalAmount: z.number({ required_error: 'Goal amount is required' }).positive('Goal amount must be positive'),
  status: z.enum(['active', 'paused']).optional(),
  coverImage: z.string().trim().url().optional().or(z.literal(''))
});

const updateCampaignSchema = createCampaignSchema.partial();

// ── Donation schemas ───────────────────────────────────────────────────────
const createDonationSchema = z.object({
  campaignId: z.string({ required_error: 'campaignId is required' }).length(24, 'Invalid campaign ID'),
  amount: z.number({ required_error: 'amount is required' }).min(1, 'Amount must be at least 1')
});

// ── Middleware factory ─────────────────────────────────────────────────────
/**
 * Returns an Express middleware that validates req.body against the given schema.
 * On failure it calls next() with a 400 AppError listing all issues.
 */
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (result.success) {
    req.body = result.data;   // coerced + trimmed data replaces raw body
    return next();
  }
  const messages = result.error.errors.map(e => e.message).join(', ');
  return res.status(400).json({ success: false, message: messages });
};

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  createCampaignSchema,
  updateCampaignSchema,
  createDonationSchema
};

// ── Refund schema ──────────────────────────────────────────────────────────
const refundDonationSchema = z.object({
  donationId: z.string().length(24, 'Invalid donation ID'),
  reason: z.string().trim().min(5, 'Please provide a reason (min 5 characters)').max(300).optional()
});

module.exports.refundDonationSchema = refundDonationSchema;

// ── Update createDonationSchema to include isAnonymous ────────────────────
// Override the existing export (validators.js re-exports everything)
const createDonationSchemaV2 = z.object({
  campaignId: z.string({ required_error: 'campaignId is required' }).length(24, 'Invalid campaign ID'),
  amount: z.number({ required_error: 'amount is required' }).min(1, 'Amount must be at least 1'),
  isAnonymous: z.boolean().optional().default(false)
});

module.exports.createDonationSchema = createDonationSchemaV2;
