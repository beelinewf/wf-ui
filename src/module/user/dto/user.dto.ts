import * as z from 'zod';

import { emailSchema, passwordSchema, refinePasswordConfirm } from '@core/auth/dto';

import type { User } from '../types/User';
import type { UserCreatePayload, UserUpdatePayload } from '../types/UserPayload';

/** A new password with its confirmation, e.g. to re-enable a disabled account. */
export const userPasswordSchema = z
	.object({ password: passwordSchema, confirmPassword: z.string() })
	.superRefine(refinePasswordConfirm);

export type UserPasswordDto = z.infer<typeof userPasswordSchema>;

export const userPasswordInitialValues: UserPasswordDto = { password: '', confirmPassword: '' };

export const userSchema = z
	.object({
		name: z.string().trim().min(1, 'Enter a name'),
		email: emailSchema,
		roles: z.array(z.string()),
		/** Required on create; on edit only when `changePassword` is on. */
		changePassword: z.boolean(),
		password: z.string(),
		confirmPassword: z.string(),
		emailVerified: z.boolean(),
		/** Edit only: keep the account verified across an email change instead of re-pending it. */
		keepVerified: z.boolean(),
	})
	.superRefine((values, ctx) => {
		if (!values.changePassword) return;
		const result = passwordSchema.safeParse(values.password);
		if (!result.success) {
			ctx.addIssue({ code: 'custom', path: ['password'], message: result.error.issues[0]?.message ?? 'Invalid' });
		}
		refinePasswordConfirm(values, ctx);
	});

export type UserDto = z.infer<typeof userSchema>;

export const userInitialValues: UserDto = {
	name: '',
	email: '',
	roles: [],
	changePassword: true,
	password: '',
	confirmPassword: '',
	emailVerified: true,
	keepVerified: true,
};

export const userToDto = (user: User): UserDto => ({
	name: user.name,
	email: user.email,
	roles: [...user.roles].sort(),
	changePassword: false,
	password: '',
	confirmPassword: '',
	emailVerified: user.email_verified,
	keepVerified: true,
});

export const userCreateFromDto = (values: UserDto): UserCreatePayload => ({
	name: values.name.trim(),
	email: values.email.trim(),
	password: values.password,
	roles: values.roles,
});

interface UserUpdateOptions {
	/** False when editing your own row: the engine ignores it for self, and self-disable is refused anyway. */
	canWrite: boolean;
	/** Whether the engine re-pends an email change. */
	verificationEnabled: boolean;
}

/** Only changed fields are sent, since an omitted field keeps the stored value. */
export const userUpdateFromDto = (
	user: User,
	values: UserDto,
	{ canWrite, verificationEnabled }: UserUpdateOptions,
): UserUpdatePayload => {
	const payload: UserUpdatePayload = {};
	const name = values.name.trim();
	const email = values.email.trim();
	const emailChanged = email.toLowerCase() !== user.email.toLowerCase();

	if (name !== user.name) payload.name = name;
	if (emailChanged) payload.email = email;
	if (values.changePassword && values.password) payload.password = values.password;
	if (!canWrite) return payload;

	const roles = [...values.roles].sort();
	if (roles.join('\n') !== [...user.roles].sort().join('\n')) payload.roles = roles;

	// An explicit verdict wins over the re-pend an email change would cause.
	if (values.emailVerified !== user.email_verified) payload.email_verified = values.emailVerified;
	else if (emailChanged && verificationEnabled && values.emailVerified && values.keepVerified) {
		payload.email_verified = true;
	}
	return payload;
};
