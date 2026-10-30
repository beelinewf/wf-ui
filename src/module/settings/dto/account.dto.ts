import * as z from 'zod';

import { emailSchema, passwordSchema, refinePasswordConfirm } from '@core/auth/dto';

export const myProfileSchema = z.object({
	name: z.string().trim().min(1, 'Enter your name'),
	email: emailSchema,
});

export type MyProfileDto = z.infer<typeof myProfileSchema>;

export const myPasswordSchema = z
	.object({
		currentPassword: z.string().min(1, 'Enter your current password'),
		password: passwordSchema,
		confirmPassword: z.string(),
	})
	.superRefine(refinePasswordConfirm);

export type MyPasswordDto = z.infer<typeof myPasswordSchema>;

export const myPasswordInitialValues: MyPasswordDto = { currentPassword: '', password: '', confirmPassword: '' };
