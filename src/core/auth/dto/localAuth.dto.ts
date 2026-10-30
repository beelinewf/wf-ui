import * as z from 'zod';

import { passwordSchema, refinePasswordConfirm } from './password.dto';

// As shallow as the engine's check: local@domain with no whitespace. The mailed link is the real proof.
export const emailSchema = z
	.string()
	.trim()
	.min(1, { error: 'Enter your email', abort: true })
	.refine((email) => /^[^\s@]+@[^\s@]+$/.test(email), 'Enter a valid email address');

export const localLoginSchema = z.object({
	email: emailSchema,
	password: z.string().min(1, 'Enter your password'),
});

export type LocalLoginDto = z.infer<typeof localLoginSchema>;

export const localLoginInitialValues: LocalLoginDto = { email: '', password: '' };

export const registerSchema = z
	.object({
		name: z.string().trim().min(1, 'Enter your name'),
		email: emailSchema,
		password: passwordSchema,
		confirmPassword: z.string(),
	})
	.superRefine(refinePasswordConfirm);

export type RegisterDto = z.infer<typeof registerSchema>;

export const registerInitialValues: RegisterDto = { name: '', email: '', password: '', confirmPassword: '' };

export const resendVerificationSchema = z.object({ email: emailSchema });

export type ResendVerificationDto = z.infer<typeof resendVerificationSchema>;
