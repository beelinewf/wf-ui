import { API_TAG_LIST_ID, apiTagConfig } from '@config/apiTag.config';

import { coreApi } from '@core/api';

import type { User } from '@module/user/types/User';
import type { UserList } from '@module/user/types/UserList';
import type { UserQuery } from '@module/user/types/UserQuery';

const RESOURCE = 'v1/users';

// Read-only: users are created just in time on first sign-in, so the engine has no user-write API.
export const userApi = coreApi.injectEndpoints({
	endpoints: (build) => ({
		listUsers: build.query<UserList, UserQuery>({
			query: (param) => ({ method: 'get', url: RESOURCE, qParam: param }),
			providesTags: (result) => [
				{ type: apiTagConfig.user, id: API_TAG_LIST_ID },
				...(result?.items ?? []).map((item) => ({ type: apiTagConfig.user, id: item.id })),
			],
		}),

		getUser: build.query<User, string>({
			query: (id) => ({ method: 'get', url: `${RESOURCE}/${encodeURIComponent(id)}` }),
			providesTags: (_result, _error, id) => [{ type: apiTagConfig.user, id }],
		}),
	}),
});
