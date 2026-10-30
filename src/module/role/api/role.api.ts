import { apiTagConfig } from '@config/apiTag.config';

import { coreApi } from '@core/api';

import type { Role } from '@module/role/types/Role';
import type { RoleList } from '@module/role/types/RoleList';
import type { RoleCreatePayload, RoleUpdatePayload } from '@module/role/types/RolePayload';

const RESOURCE = 'v1/roles';

const roleUrl = (name: string) => `${RESOURCE}/${encodeURIComponent(name)}`;

// A role write can change the caller's own grants, so /auth/me is refreshed alongside the catalog.
export const roleApi = coreApi.injectEndpoints({
	endpoints: (build) => ({
		listRoles: build.query<RoleList, void>({
			query: () => ({ method: 'get', url: RESOURCE }),
			providesTags: (result) => [
				{ type: apiTagConfig.role },
				...(result?.items ?? []).map((item) => ({
					type: apiTagConfig.role,
					id: item.name,
				})),
			],
		}),

		getRole: build.query<Role, string>({
			query: (name) => ({ method: 'get', url: roleUrl(name) }),
			providesTags: (_result, _error, name) => [{ type: apiTagConfig.role, id: name }],
		}),

		createRole: build.mutation<Role, RoleCreatePayload>({
			query: (body) => ({ method: 'post', url: RESOURCE, body }),
			invalidatesTags: [{ type: apiTagConfig.role }, { type: apiTagConfig.me }],
		}),

		updateRole: build.mutation<Role, { name: string; payload: RoleUpdatePayload }>({
			query: ({ name, payload }) => ({
				method: 'put',
				url: roleUrl(name),
				body: payload,
			}),
			invalidatesTags: (_result, _error, { name }) => [
				{ type: apiTagConfig.role },
				{ type: apiTagConfig.role, id: name },
				{ type: apiTagConfig.me },
			],
		}),

		deleteRole: build.mutation<void, string>({
			query: (name) => ({ method: 'delete', url: roleUrl(name) }),
			invalidatesTags: (_result, _error, name) => [
				{ type: apiTagConfig.role },
				{ type: apiTagConfig.role, id: name },
				{ type: apiTagConfig.me },
			],
		}),
	}),
});
