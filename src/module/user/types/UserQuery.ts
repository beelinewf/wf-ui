import type { ComplexQueryParam } from '@common/types/ComplexQueryParam';

export interface UserQueryFilter {
	/** true: only password accounts; false: only provider and system rows. */
	is_local?: boolean;
	/** true: only proven mailboxes; false: only pending ones. */
	email_verified?: boolean;
	/** true: only enabled accounts; false: only disabled ones. */
	is_active?: boolean;
	/** Case-insensitive substring. */
	email?: string;
	/** Case-insensitive substring. */
	name?: string;
	/** Membership in any of these; only local users carry stored roles. */
	roles?: string[];
}

/** Newest first; the filters combine with AND. */
export type UserQuery = Pick<ComplexQueryParam, 'page' | 'perPage'> & { filter?: UserQueryFilter };
