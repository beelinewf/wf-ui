import * as z from 'zod';

import type { Role } from '../types/Role';
import type { RoleCreatePayload, RoleUpdatePayload } from '../types/RolePayload';

export const roleSchema = z.object({
	name: z.string().trim().min(1, 'Enter a role name'),
	description: z.string(),
	permissions: z.array(z.string()),
});

export type RoleDto = z.infer<typeof roleSchema>;

export const roleInitialValues: RoleDto = {
	name: '',
	description: '',
	permissions: [],
};

export const roleToDto = (role: Role): RoleDto => ({
	name: role.name,
	description: role.description ?? '',
	permissions: [...role.permissions].sort(),
});

export const roleCreateFromDto = (values: RoleDto): RoleCreatePayload => ({
	name: values.name.trim(),
	description: values.description.trim() || undefined,
	permissions: values.permissions,
});

export const roleUpdateFromDto = (values: RoleDto): RoleUpdatePayload => ({
	description: values.description.trim(),
	permissions: values.permissions,
});
