import {
	parseAsArrayOf,
	parseAsBoolean,
	parseAsInteger,
	parseAsNumberLiteral,
	parseAsString,
	parseAsStringLiteral,
	useQueryStates,
} from 'nuqs';

import { PER_PAGE_OPTIONS } from '@common/component/PaginationBar';

import { USER_DETAIL_PARAM, USER_NEW_PARAM, USER_SOURCE_FILTERS, USER_STATUS_FILTERS } from '@module/user/constant';
import type { UserQueryFilter } from '@module/user/types/UserQuery';

export type UserSourceFilter = (typeof USER_SOURCE_FILTERS)[number];

export type UserStatusFilter = (typeof USER_STATUS_FILTERS)[number];

// Kept in the URL so a filtered view can be linked.
const listParsers = {
	search: parseAsString.withDefault(''),
	source: parseAsStringLiteral(USER_SOURCE_FILTERS).withDefault('all'),
	status: parseAsStringLiteral(USER_STATUS_FILTERS).withDefault('all'),
	roles: parseAsArrayOf(parseAsString).withDefault([]),
	page: parseAsInteger.withDefault(1),
	perPage: parseAsNumberLiteral(PER_PAGE_OPTIONS).withDefault(PER_PAGE_OPTIONS[0]),
};

const listUrlKeys = {
	search: 'q',
	roles: 'role',
	perPage: 'per_page',
};

export const useUserListParams = () => useQueryStates(listParsers, { urlKeys: listUrlKeys, history: 'replace' });

const panelParsers = {
	selected: parseAsString,
	creating: parseAsBoolean.withDefault(false),
};

const panelUrlKeys = {
	selected: USER_DETAIL_PARAM,
	creating: USER_NEW_PARAM,
};

/** The open side panel lives in the URL, so a user can be linked to and survives a reload. */
export const useUserPanelParams = () => useQueryStates(panelParsers, { urlKeys: panelUrlKeys, history: 'replace' });

const STATUS_FILTER: Record<UserStatusFilter, UserQueryFilter> = {
	all: {},
	active: { is_active: true, email_verified: true },
	pending: { is_active: true, email_verified: false },
	disabled: { is_active: false },
};

/**
 * The list filters as engine query params. The engine has no OR, so a search term matches email when it looks like
 * one and the name otherwise.
 */
export const toUserQueryFilter = (params: {
	search: string;
	source: UserSourceFilter;
	status: UserStatusFilter;
	roles: string[];
}): UserQueryFilter => {
	const term = params.search.trim();
	return {
		...(params.source === 'all' ? {} : { is_local: params.source === 'local' }),
		...STATUS_FILTER[params.status],
		...(term ? (term.includes('@') ? { email: term } : { name: term }) : {}),
		...(params.roles.length ? { roles: params.roles } : {}),
	};
};
