import { useMemo } from 'react';

import { Permission, useCan } from '@core/auth/authorization';
import { useGetAuthConfigQuery } from '@core/auth/hooks';

import { useListRolesQuery } from '@module/role/hooks';

export interface UserRoleOption {
	name: string;
	description?: string | null;
}

/**
 * The roles a local user can be given. The catalog carries descriptions but needs roles:read; without it the public
 * auth config still names every role.
 */
export const useUserRoleOptions = () => {
	const canReadRoles = useCan(Permission.RolesRead);
	const catalog = useListRolesQuery(undefined, { skip: !canReadRoles });
	const { data: authConfig, isLoading: isConfigLoading } = useGetAuthConfigQuery();

	const options = useMemo<UserRoleOption[]>(() => {
		if (catalog.data) return catalog.data.items.map(({ name, description }) => ({ name, description }));
		return (authConfig?.roles ?? []).map((name) => ({ name }));
	}, [catalog.data, authConfig]);

	return { options, isLoading: canReadRoles ? catalog.isLoading : isConfigLoading };
};
