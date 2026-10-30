import { API_TAG_LIST_ID, apiTagConfig } from '@config/apiTag.config';

import { coreApi } from '@core/api';

import type { ComplexQueryParam } from '@common/types/ComplexQueryParam';

import type { User } from '@module/user/types/User';
import type { UserList } from '@module/user/types/UserList';
import type { UserCreatePayload, UserUpdatePayload } from '@module/user/types/UserPayload';
import type { UserQuery } from '@module/user/types/UserQuery';

const RESOURCE = 'v1/users';

const userUrl = (id: string) => `${RESOURCE}/${encodeURIComponent(id)}`;

const toQueryParam = ({ page, perPage, filter = {} }: UserQuery): ComplexQueryParam => {
	const { roles, ...rest } = filter;
	const entries = Object.entries(rest).filter(([, value]) => value !== undefined && value !== '');
	return {
		page,
		perPage,
		filter: {
			...Object.fromEntries(entries.map(([key, value]) => [key, { op: '_eq', value }])),
			// The engine reads `role` comma-separated, not as repeated keys.
			...(roles?.length ? { role: { op: '_eq', value: roles.join(',') } } : {}),
		},
	};
};

// Writes cover local accounts only; OIDC users are created just in time on first sign-in and are read-only here.
export const userApi = coreApi.injectEndpoints({
	endpoints: (build) => ({
		listUsers: build.query<UserList, UserQuery>({
			query: (param) => ({ method: 'get', url: RESOURCE, qParam: toQueryParam(param) }),
			providesTags: (result) => [
				{ type: apiTagConfig.user, id: API_TAG_LIST_ID },
				...(result?.items ?? []).map((item) => ({ type: apiTagConfig.user, id: item.id })),
			],
		}),

		getUser: build.query<User, string>({
			query: (id) => ({ method: 'get', url: userUrl(id) }),
			providesTags: (_result, _error, id) => [{ type: apiTagConfig.user, id }],
		}),

		createUser: build.mutation<User, UserCreatePayload>({
			query: (body) => ({ method: 'post', url: RESOURCE, body }),
			invalidatesTags: [{ type: apiTagConfig.user, id: API_TAG_LIST_ID }],
		}),

		/** Pass `self` when the caller edits their own account, so /auth/me picks up a new name or email. */
		updateUser: build.mutation<User, { id: string; payload: UserUpdatePayload; self?: boolean }>({
			query: ({ id, payload }) => ({ method: 'put', url: userUrl(id), body: payload }),
			invalidatesTags: (_result, _error, { id, self }) => [
				{ type: apiTagConfig.user, id },
				{ type: apiTagConfig.user, id: API_TAG_LIST_ID },
				...(self ? [{ type: apiTagConfig.me }] : []),
			],
		}),

		/** A soft delete: the row stays, the credential is cleared and the user's tokens stop working at once. */
		disableUser: build.mutation<void, string>({
			query: (id) => ({ method: 'delete', url: userUrl(id) }),
			invalidatesTags: (_result, _error, id) => [
				{ type: apiTagConfig.user, id },
				{ type: apiTagConfig.user, id: API_TAG_LIST_ID },
			],
		}),

		resendUserVerification: build.mutation<void, string>({
			query: (id) => ({ method: 'post', url: `${userUrl(id)}/resend-verification` }),
		}),
	}),
});
