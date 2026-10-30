import { roleApi } from '@module/role/api';

export const {
	useListRolesQuery,
	useGetRoleQuery,
	useCreateRoleMutation,
	useUpdateRoleMutation,
	useDeleteRoleMutation,
} = roleApi;
