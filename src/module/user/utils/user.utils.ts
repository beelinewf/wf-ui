import type { User } from '@module/user/types/User';

export const userDisplayName = (user: Pick<User, 'name' | 'email'>) => user.name || user.email || 'Unnamed user';

/** A user with no provider identity, such as the system user the API token records as. */
export const isSystemUser = (user: Pick<User, 'subject'>) => !user.subject;

/** The issuer's host, which reads better in a table than the full URL. */
export const issuerLabel = (issuer: string) => {
	try {
		return new URL(issuer).host || issuer;
	} catch {
		return issuer;
	}
};

/** The tail of a user id, as the breadcrumb shortens uuids. */
export const shortUserId = (id: string) => `#${id.slice(-8)}`;
