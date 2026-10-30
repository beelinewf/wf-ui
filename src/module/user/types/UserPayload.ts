export interface UserCreatePayload {
	name: string;
	email: string;
	password: string;
	roles?: string[];
}

/** An omitted field keeps the stored value. */
export interface UserUpdatePayload {
	name?: string;
	/** A change makes the account unverified again while verification is on. */
	email?: string;
	/** Fully replaces the membership set. users:write only. */
	roles?: string[];
	password?: string;
	/** Required when the account itself rotates its password; a mismatch is 422. */
	current_password?: string;
	/** users:write only. */
	is_active?: boolean;
	/** An explicit verdict that retires any outstanding link. users:write only. */
	email_verified?: boolean;
}
