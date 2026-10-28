export interface User {
	/** users.id, the audit actor recorded as created_by / updated_by. */
	id: string;
	/** Provider subject; null for a user with no provider identity, such as the system user. */
	subject?: string | null;
	/** Provider issuer; null for a user with no provider identity. */
	issuer?: string | null;
	name: string;
	email: string;
	created_at: string;
	updated_at: string;
}
