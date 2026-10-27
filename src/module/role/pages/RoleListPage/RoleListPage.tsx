import React, { useState } from 'react';

import { Alert, Anchor, Button, Group, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { LuCircleAlert, LuExternalLink, LuInfo, LuShieldCheck } from 'react-icons/lu';

import { config } from '@config/config';

import { useAsyncQuery } from '@common/hooks/useAsyncQuery';

import { RoleDetailDrawer } from '@module/role/components/RoleDetailDrawer';
import { RolePermissionMatrix } from '@module/role/components/RolePermissionMatrix';
import { useListRolesQuery } from '@module/role/hooks';
import type { Role } from '@module/role/types/Role';

const SKELETON_COLUMNS = 3;

export const RoleListPage: React.FC = () => {
	const { data: result, isFetching, isError, refetch } = useListRolesQuery();
	const { data: appConfig } = useAsyncQuery(() => config.getValue(), null);
	const idpAdminUrl = appConfig?.BEELINE_UI_IDP_ADMIN_URL;
	const [selected, setSelected] = useState<Role | null>(null);

	const renderMatrix = () => {
		if (isError && !isFetching) {
			return (
				<Stack align="center" gap="xs" py={48}>
					<ThemeIcon size={48} radius="xl" variant="light" color="red">
						<LuCircleAlert size={22} />
					</ThemeIcon>
					<Text fw={600}>Couldn't load roles</Text>
					<Button variant="default" size="xs" mt={4} onClick={refetch}>
						Try again
					</Button>
				</Stack>
			);
		}

		if (!result)
			return <RolePermissionMatrix roles={[]} onSelectRole={() => {}} skeletonColumns={SKELETON_COLUMNS} />;

		if (result.items.length === 0) {
			return (
				<Stack align="center" gap="xs" py={48}>
					<ThemeIcon size={48} radius="xl" variant="light" color="gray">
						<LuShieldCheck size={22} />
					</ThemeIcon>
					<Text fw={600}>No roles configured</Text>
					<Text fz="sm" c="dimmed" ta="center" maw={360}>
						The engine's role catalog is empty, so only the API token can call gated endpoints.
					</Text>
				</Stack>
			);
		}

		return <RolePermissionMatrix roles={result.items} onSelectRole={setSelected} />;
	};

	return (
		<Paper withBorder radius="md" p="lg">
			<Stack gap="md">
				<Group justify="space-between" align="flex-start" gap="sm">
					<div>
						<Title order={3} fz="md">
							Roles
						</Title>
						<Text c="dimmed" fz="sm">
							What each role can do. Select a role for its details.
						</Text>
					</div>
					{result && (
						<Text fz="sm" c="dimmed">
							{result.items.length} {result.items.length === 1 ? 'role' : 'roles'}
						</Text>
					)}
				</Group>

				<Alert color="blue" variant="light" icon={<LuInfo size={16} />} p="xs">
					<Text fz="sm">
						Roles are read-only here. They come from the engine configuration, and users get them from the
						identity provider's role claim.{' '}
						{idpAdminUrl && (
							<Anchor href={idpAdminUrl} target="_blank" rel="noreferrer" fz="sm">
								<Group gap={4} component="span" display="inline-flex">
									Manage role assignments
									<LuExternalLink size={12} aria-hidden />
								</Group>
							</Anchor>
						)}
					</Text>
				</Alert>

				<div aria-busy={isFetching}>{renderMatrix()}</div>
			</Stack>

			<RoleDetailDrawer role={selected} onClose={() => setSelected(null)} />
		</Paper>
	);
};
