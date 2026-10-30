export interface User {
	/** users.id, the audit actor recorded as created_by / updated_by. */
	id: string;
	/** Provider subject; null for a user with no provider identity, such as the system user. A local user's is its id. */
	subject?: string | null;
	/** Provider issuer, `"local"` for a password account; null for a user with no provider identity. */
	issuer?: string | null;
	name: string;
	email: string;
	/** A local user's stored roles; empty for OIDC users, whose roles ride on their live token. */
	roles: string[];
	/** False for a disabled (soft-deleted) account. */
	is_active: boolean;
	/** False while a self-registered account awaits its verification link. */
	email_verified: boolean;
	/** True for a password account rather than an OIDC identity. */
	is_local: boolean;
	created_at: string;
	updated_at: string;
}
