import type { User } from '@module/user/types/User';

export interface RegisterRequest {
	name: string;
	email: string;
	password: string;
}

export interface RegisterResponse {
	user: User;
	/** True when the account awaits its mailed link and no token was issued. */
	pending_verification: boolean;
	/** Present only when the account activates at once. */
	access_token?: string;
	token_type?: string;
	expires_in?: number;
}

export interface LoginRequest {
	email: string;
	password: string;
}

export interface LoginResponse {
	/** HS256 JWT for the Authorization header. */
	access_token: string;
	token_type: string;
	/** Whole seconds until the token expires; there is no refresh. */
	expires_in: number;
	user: User;
}

export interface VerifyEmailRequest {
	token: string;
}

export interface ResendVerificationRequest {
	email: string;
}

export interface ResendVerificationResponse {
	message: string;
}
