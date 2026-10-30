import { USER_DETAIL_PARAM, USER_NEW_PARAM } from '@module/user/constant';
import type { User } from '@module/user/types/User';
import type { UserSource, UserStatus } from '@module/user/types/UserStatus';

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

export const userSource = (user: Pick<User, 'subject' | 'is_local'>): UserSource => {
	if (user.is_local) return 'local';
	return isSystemUser(user) ? 'system' : 'sso';
};

export const userStatus = (user: Pick<User, 'is_active' | 'email_verified'>): UserStatus => {
	if (!user.is_active) return 'disabled';
	return user.email_verified ? 'active' : 'pending';
};

/** Only password accounts can be edited here; OIDC rows belong to the identity provider. */
export const isEditableUser = (user: Pick<User, 'is_local'>) => user.is_local;

export const userPath = () => '/app/user';

/** The list with the new-user form open in the side panel. */
export const userNewPath = () => `${userPath()}?${USER_NEW_PARAM}=true`;

/** The list with the user open in the side panel, where a local user is also edited. */
export const userDetailPath = (id: string) => `${userPath()}?${USER_DETAIL_PARAM}=${encodeURIComponent(id)}`;
