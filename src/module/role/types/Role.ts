export interface Role {
	name: string;
	/** Authored over the API, or derived as "Configured role <name>" when omitted at creation. */
	description?: string | null;
	/** Actions the role grants, as the role tables store them. May include the `*` wildcard. */
	permissions: string[];
	created_at: string;
	updated_at: string;
}
