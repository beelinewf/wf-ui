export interface RoleCreatePayload {
	name: string;
	/** Omitted or blank derives "Configured role <name>". */
	description?: string;
	permissions?: string[];
}

export interface RoleUpdatePayload {
	/** Omitted keeps the stored description. */
	description?: string;
	/** Fully replaces the grant set; an empty list revokes every grant. */
	permissions?: string[];
}
