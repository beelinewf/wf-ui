import type { UserSource, UserStatus } from '@module/user/types/UserStatus';

/** The engine's page size cap; the picker lists this many and accepts a pasted id for the rest. */
export const USER_PICKER_PAGE_SIZE = 200;

export const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const USER_SOURCE_META: Record<UserSource, { label: string; color: string }> = {
	local: { label: 'Local', color: 'brand' },
	sso: { label: 'SSO', color: 'blue' },
	system: { label: 'System', color: 'gray' },
};

export const USER_STATUS_META: Record<UserStatus, { label: string; color: string }> = {
	active: { label: 'Active', color: 'teal' },
	pending: { label: 'Pending verification', color: 'yellow' },
	disabled: { label: 'Disabled', color: 'gray' },
};

export const USER_SOURCE_FILTERS = ['all', 'local', 'sso'] as const;

export const USER_STATUS_FILTERS = ['all', 'active', 'pending', 'disabled'] as const;

export const USER_SEARCH_DEBOUNCE_MS = 300;

/** The list's query param naming the user whose side panel is open. */
export const USER_DETAIL_PARAM = 'user';

/** The list's query param that opens the new-user form in the side panel. */
export const USER_NEW_PARAM = 'new';
