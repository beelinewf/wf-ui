import * as z from 'zod';

// Mirrors validatePassword in wf-engine internal/workflow/service/local_users.go: bcrypt refuses past 72 bytes, so
// the length is counted in UTF-8 bytes, not characters.
export const PASSWORD_MIN_BYTES = 6;
export const PASSWORD_MAX_BYTES = 72;

const encoder = new TextEncoder();

const byteLength = (value: string) => encoder.encode(value).length;

export interface PasswordRequirement {
	id: 'length' | 'upper' | 'number' | 'symbol';
	label: string;
	test: (password: string) => boolean;
}

/** In display order, for the checklist under a password field. */
export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
	{
		id: 'length',
		label: `${PASSWORD_MIN_BYTES} to ${PASSWORD_MAX_BYTES} characters`,
		test: (password) => byteLength(password) >= PASSWORD_MIN_BYTES && byteLength(password) <= PASSWORD_MAX_BYTES,
	},
	{ id: 'upper', label: 'One uppercase letter', test: (password) => /\p{Lu}/u.test(password) },
	{ id: 'number', label: 'One number', test: (password) => /\p{Nd}/u.test(password) },
	// The engine counts anything that is not a letter, a digit or whitespace.
	{ id: 'symbol', label: 'One symbol', test: (password) => /[^\p{L}\p{Nd}\s]/u.test(password) },
];

export const isPasswordValid = (password: string) => PASSWORD_REQUIREMENTS.every(({ test }) => test(password));

export const passwordSchema = z
	.string()
	.min(1, { error: 'Enter a password', abort: true })
	// Each check aborts so only the first failing rule is reported for the field.
	.refine((password) => byteLength(password) >= PASSWORD_MIN_BYTES, {
		error: `At least ${PASSWORD_MIN_BYTES} characters`,
		abort: true,
	})
	.refine((password) => byteLength(password) <= PASSWORD_MAX_BYTES, {
		error: `At most ${PASSWORD_MAX_BYTES} characters`,
		abort: true,
	})
	.refine(isPasswordValid, 'Add an uppercase letter, a number and a symbol');

/** A superRefine step: `confirmPassword` must repeat `password`. */
export const refinePasswordConfirm = <T extends { password: string; confirmPassword: string }>(
	values: T,
	ctx: z.RefinementCtx,
) => {
	if (values.password && values.confirmPassword !== values.password) {
		ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: "Passwords don't match" });
	}
};
