import React, { useCallback, useEffect, useState } from 'react';

import {
	ActionIcon,
	Anchor,
	Button,
	Group,
	Modal,
	ScrollArea,
	Stack,
	Text,
	ThemeIcon,
	Title,
	Tooltip,
} from '@mantine/core';
import { LuCircleAlert, LuExternalLink, LuPlus, LuRefreshCw, LuShieldCheck } from 'react-icons/lu';
import { useBlocker, useSearchParams } from 'react-router';

import { config } from '@config/config';

import { Can, Permission, useCan } from '@core/auth/authorization';

import { UnsavedChangesModal } from '@common/component/EditorPage';
import { useAsyncQuery } from '@common/hooks/useAsyncQuery';

import { MainLayoutPanel } from '@module/app/components/AppMainLayout';
import { useAppLayoutPanel, useAppLayoutPanels } from '@module/app/hooks';
import { RoleDeleteModal } from '@module/role/components/RoleDeleteModal';
import { RolePanel } from '@module/role/components/RolePanel';
import { RoleTable } from '@module/role/components/RoleTable';
import { ROLE_DETAIL_PARAM, ROLE_NEW_PARAM } from '@module/role/constant';
import { useListRolesQuery, useRoleDelete } from '@module/role/hooks';
import type { Role } from '@module/role/types/Role';

import classes from './RoleListPage.module.scss';

const SKELETON_ROWS = 5;

const PANEL_WIDTH = 440;

/** What the side panel shows: a role by name, the new-role form, or nothing. */
type PanelTarget = { name: string } | 'new' | null;

export const RoleListPage: React.FC = () => {
	const { data: result, isFetching, isError, refetch } = useListRolesQuery();
	const canWrite = useCan(Permission.RolesWrite);
	const { data: appConfig } = useAsyncQuery(() => config.getValue(), null);
	const idpAdminUrl = appConfig?.BEELINE_UI_IDP_ADMIN_URL;

	// The open panel lives in the URL, so a role can be linked to and survives a reload.
	const [search, setSearch] = useSearchParams();
	const selectedName = search.get(ROLE_DETAIL_PARAM);
	const creating = canWrite && search.has(ROLE_NEW_PARAM);
	const panelOpen = creating || !!selectedName;
	const selected = result?.items.find((role) => role.name === selectedName);

	useAppLayoutPanels({ right: { opened: false } });
	const { open: openPanel, setOpened: setPanelOpened } = useAppLayoutPanel();
	useEffect(() => {
		setPanelOpened('right', panelOpen);
	}, [panelOpen, setPanelOpened]);

	const setPanel = (target: PanelTarget) =>
		setSearch(
			(current) => {
				const next = new URLSearchParams(current);
				next.delete(ROLE_DETAIL_PARAM);
				next.delete(ROLE_NEW_PARAM);
				if (target === 'new') next.set(ROLE_NEW_PARAM, '1');
				else if (target) next.set(ROLE_DETAIL_PARAM, target.name);
				return next;
			},
			{ replace: true },
		);

	// Unsaved edits in the panel hold back switching roles, closing it and leaving the page.
	const [dirty, setDirty] = useState(false);
	const handleDirtyChange = useCallback((value: boolean) => setDirty(value), []);
	const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
	const guard = (action: () => void) => (dirty ? setPendingAction(() => action) : action());
	const blocker = useBlocker(
		({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname,
	);

	const show = (target: Exclude<PanelTarget, null>) => {
		const same = target === 'new' ? creating : target.name === selectedName;
		const apply = () => {
			setPanel(target);
			// The panel can be closed while its target stays in the URL (e.g. a dismissed drawer on a narrow screen).
			openPanel('right');
		};
		if (same) apply();
		else guard(apply);
	};

	const roleDelete = useRoleDelete((role) => {
		if (role.name === selectedName) {
			setDirty(false);
			setPanel(null);
		}
	});

	const renderResults = () => {
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

		if (!result) return <RoleTable roles={[]} onSelect={() => {}} skeletonRows={SKELETON_ROWS} />;

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
					<Can rule={Permission.RolesWrite}>
						<Button size="xs" mt={4} leftSection={<LuPlus size={14} />} onClick={() => show('new')}>
							New role
						</Button>
					</Can>
				</Stack>
			);
		}

		return (
			<RoleTable
				roles={result.items}
				selectedName={panelOpen ? selectedName : null}
				onSelect={(role: Role) => show({ name: role.name })}
				onDelete={canWrite ? roleDelete.open : undefined}
			/>
		);
	};

	return (
		<>
			<ScrollArea h="100%" className={classes.canvas}>
				<div className={classes.inset}>
					<Stack gap="lg" p={{ base: 'md', md: 'xl' }} maw={1180} mx="auto">
						<Group justify="space-between" align="flex-end" gap="sm">
							<div>
								<Title order={2} fz={22}>
									Roles
								</Title>
								<Text fz="sm" c="dimmed">
									Every role and how much it grants. Select a role to see or change its permissions.
									SSO users get roles from the identity provider's role claim; local users get the
									roles assigned to them here.{' '}
									{idpAdminUrl && (
										<Anchor href={idpAdminUrl} target="_blank" rel="noreferrer" fz="sm">
											<Group gap={4} component="span" display="inline-flex">
												Manage SSO role assignments
												<LuExternalLink size={12} aria-hidden />
											</Group>
										</Anchor>
									)}
								</Text>
							</div>
							<Group gap="xs">
								{result && (
									<Text fz="sm" c="dimmed">
										{result.items.length} {result.items.length === 1 ? 'role' : 'roles'}
									</Text>
								)}
								<Tooltip label="Refresh">
									<ActionIcon
										variant="default"
										size={36}
										aria-label="Refresh roles"
										onClick={refetch}
										loading={isFetching && !!result}
									>
										<LuRefreshCw size={16} />
									</ActionIcon>
								</Tooltip>
								<Can rule={Permission.RolesWrite}>
									<Button leftSection={<LuPlus size={16} />} onClick={() => show('new')}>
										New role
									</Button>
								</Can>
							</Group>
						</Group>

						<div
							className={classes.results}
							data-loading={(isFetching && !!result) || undefined}
							aria-busy={isFetching}
						>
							{renderResults()}
						</div>
					</Stack>
				</div>
			</ScrollArea>

			{panelOpen && (
				<MainLayoutPanel side="right" w={PANEL_WIDTH} drawerBelow="md">
					<RolePanel
						name={creating ? null : selectedName}
						fallback={selected}
						onClose={() => guard(() => setPanel(null))}
						onCreated={(role) => setPanel({ name: role.name })}
						onDelete={roleDelete.open}
						onDirtyChange={handleDirtyChange}
					/>
				</MainLayoutPanel>
			)}

			<RoleDeleteModal {...roleDelete.modalProps} />
			<UnsavedChangesModal blocker={blocker} />
			<Modal opened={!!pendingAction} onClose={() => setPendingAction(null)} title="Discard changes?" centered>
				<Text fz="sm" c="dimmed">
					You have unsaved changes to this role. If you continue, they'll be lost.
				</Text>
				<Group justify="flex-end" mt="lg" gap="xs">
					<Button variant="default" onClick={() => setPendingAction(null)}>
						Keep editing
					</Button>
					<Button
						color="red"
						onClick={() => {
							setDirty(false);
							pendingAction?.();
							setPendingAction(null);
						}}
					>
						Discard changes
					</Button>
				</Group>
			</Modal>
		</>
	);
};
