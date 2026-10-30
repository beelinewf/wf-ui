import { Permission, WILDCARD_PERMISSION } from '@core/auth/authorization';

import { ROLE_DETAIL_PARAM, ROLE_NEW_PARAM } from '@module/role/constant';

const KNOWN_PERMISSIONS = new Set<string>(Object.values(Permission));

export const isKnownPermission = (value: string): value is Permission => KNOWN_PERMISSIONS.has(value);

/**
 * Permissions the backend returned that this UI does not know. The wildcard is a known spelling of the
 * bypass, not drift, so it is left out.
 */
export const unrecognizedPermissions = (permissions: string[]): string[] =>
	[...new Set(permissions)].filter((value) => value !== WILDCARD_PERMISSION && !isKnownPermission(value)).sort();

export const hasWildcard = (permissions: string[]) => permissions.includes(WILDCARD_PERMISSION);

/** Known permissions the role grants, counted once each. */
export const grantedPermissionCount = (permissions: string[]) => new Set(permissions.filter(isKnownPermission)).size;

export const rolePath = () => '/app/role';

/** The list with the new-role form open in the side panel. */
export const roleNewPath = () => `${rolePath()}?${ROLE_NEW_PARAM}=1`;

/** The list with the role open in the side panel, where it is also edited. */
export const roleDetailPath = (name: string) => `${rolePath()}?${ROLE_DETAIL_PARAM}=${encodeURIComponent(name)}`;

/** Whether any of the caller's roles is `name`, so editing it changes the caller's own access. */
export const holdsRole = (roles: string[] | undefined, name: string) => !!roles?.includes(name);
