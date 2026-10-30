import React, { useCallback, useEffect, useState } from 'react';

import { ActionIcon, Button, Group, Modal, ScrollArea, Stack, Text, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { LuCircleAlert, LuExternalLink, LuPlus, LuRefreshCw, LuSearchX, LuUsers } from 'react-icons/lu';
import { useBlocker } from 'react-router';

import { config } from '@config/config';

import { Can, Permission, useCan } from '@core/auth/authorization';
import { useGetAuthConfigQuery, useMe } from '@core/auth/hooks';

import { UnsavedChangesModal } from '@common/component/EditorPage';
import { PaginationBar } from '@common/component/PaginationBar';
import { useAsyncQuery } from '@common/hooks/useAsyncQuery';

import { MainLayoutPanel } from '@module/app/components/AppMainLayout';
import { useAppLayoutPanel, useAppLayoutPanels } from '@module/app/hooks';
import { UserDisableModal } from '@module/user/components/UserDisableModal';
import { UserEnableModal } from '@module/user/components/UserEnableModal';
import { UserFilters, type UserFilterValues } from '@module/user/components/UserFilters';
import { UserPanel } from '@module/user/components/UserPanel';
import { UserTable } from '@module/user/components/UserTable';
import { USER_SEARCH_DEBOUNCE_MS } from '@module/user/constant';
import {
	toUserQueryFilter,
	useListUsersQuery,
	useUserAccountActions,
	useUserListParams,
	useUserPanelParams,
} from '@module/user/hooks';
import type { User } from '@module/user/types/User';

import classes from './UserListPage.module.scss';

const PANEL_WIDTH = 440;

/** What the side panel shows: a user by id, the new-user form, or nothing. */
type PanelTarget = { id: string } | 'new' | null;

export const UserListPage: React.FC = () => {
	const [params, setParams] = useUserListParams();
	const { search, source, status, roles, page, perPage } = params;
	const [debouncedSearch] = useDebouncedValue(search, USER_SEARCH_DEBOUNCE_MS);

	const canWrite = useCan(Permission.UsersWrite);
	const { data: me } = useMe();
	const { data: authConfig } = useGetAuthConfigQuery();
	const localEnabled = !!authConfig?.local_enabled;
	const account = useUserAccountActions();

	const filter = toUserQueryFilter({ search: debouncedSearch, source, status, roles });
	const { data: result, isFetching, isError, refetch } = useListUsersQuery({ page, perPage, filter });
	const { data: appConfig } = useAsyncQuery(() => config.getValue(), null);
	const idpAdminUrl = appConfig?.BEELINE_UI_IDP_ADMIN_URL;

	const hasActiveFilters = !!search || source !== 'all' || status !== 'all' || roles.length > 0;
	const clearFilters = () => setParams({ search: null, source: null, status: null, roles: null, page: null });
	const handleFilterChange = (value: Partial<UserFilterValues>) => setParams({ ...value, page: null });

	const [{ selected: selectedId, creating: creatingParam }, setPanelParams] = useUserPanelParams();
	const creating = canWrite && creatingParam;
	const panelOpen = creating || !!selectedId;
	const selected = result?.items.find((user) => user.id === selectedId);

	useAppLayoutPanels({ right: { opened: false } });
	const { open: openPanel, setOpened: setPanelOpened } = useAppLayoutPanel();
	useEffect(() => {
		setPanelOpened('right', panelOpen);
	}, [panelOpen, setPanelOpened]);

	const setPanel = (target: PanelTarget) =>
		setPanelParams({
			selected: target && target !== 'new' ? target.id : null,
			creating: target === 'new' ? true : null,
		});

	// Unsaved edits in the panel hold back switching users, closing it and leaving the page.
	const [dirty, setDirty] = useState(false);
	const handleDirtyChange = useCallback((value: boolean) => setDirty(value), []);
	const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
	const guard = (action: () => void) => (dirty ? setPendingAction(() => action) : action());
	const blocker = useBlocker(
		({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname,
	);

	const show = (target: Exclude<PanelTarget, null>) => {
		const same = target === 'new' ? creating : target.id === selectedId;
		const apply = () => {
			setPanel(target);
			// The panel can be closed while its target stays in the URL (e.g. a dismissed drawer on a narrow screen).
			openPanel('right');
		};
		if (same) apply();
		else guard(apply);
	};

	const renderResults = () => {
		if (isError && !isFetching) {
			return (
				<Stack align="center" gap="xs" py={48}>
					<ThemeIcon size={48} radius="xl" variant="light" color="red">
						<LuCircleAlert size={22} />
					</ThemeIcon>
					<Text fw={600}>Couldn't load users</Text>
					<Button variant="default" size="xs" mt={4} onClick={refetch}>
						Try again
					</Button>
				</Stack>
			);
		}

		if (!result) return <UserTable users={[]} onSelect={() => {}} skeletonRows={perPage} />;

		if (result.items.length === 0 && hasActiveFilters) {
			return (
				<Stack align="center" gap="xs" py={48}>
					<ThemeIcon size={48} radius="xl" variant="light" color="gray">
						<LuSearchX size={22} />
					</ThemeIcon>
					<Text fw={600}>No users match these filters</Text>
					<Button variant="default" size="xs" mt={4} onClick={clearFilters}>
						Clear filters
					</Button>
				</Stack>
			);
		}

		if (result.items.length === 0) {
			return (
				<Stack align="center" gap="xs" py={48}>
					<ThemeIcon size={48} radius="xl" variant="light" color="gray">
						<LuUsers size={22} />
					</ThemeIcon>
					<Text fw={600}>No users yet</Text>
					<Text fz="sm" c="dimmed" ta="center" maw={360}>
						{localEnabled
							? 'Add a user with an email and password, or let people register themselves.'
							: 'A user is added here the first time they sign in through the identity provider.'}
					</Text>
				</Stack>
			);
		}

		return (
			<div className={classes.results} data-loading={isFetching || undefined} aria-busy={isFetching}>
				<UserTable
					users={result.items}
					selectedId={panelOpen ? selectedId : null}
					onSelect={(user: User) => show({ id: user.id })}
					selfId={me?.id}
					actions={canWrite ? { onDisable: account.disable, onEnable: account.enable } : undefined}
				/>
			</div>
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
									Users
								</Title>
								<Text fz="sm" c="dimmed">
									{localEnabled
										? 'Local accounts and everyone who has signed in through SSO, newest first. Select a user to see or change their account.'
										: 'Everyone who has signed in, newest first. Accounts and role assignments live in the identity provider.'}
								</Text>
							</div>
							<Group gap="xs">
								{result && (
									<Text fz="sm" c="dimmed">
										{result.total} {result.total === 1 ? 'user' : 'users'}
									</Text>
								)}
								<Tooltip label="Refresh">
									<ActionIcon
										variant="default"
										size={36}
										aria-label="Refresh users"
										onClick={refetch}
										loading={isFetching && !!result}
									>
										<LuRefreshCw size={16} />
									</ActionIcon>
								</Tooltip>
								{idpAdminUrl && (
									<Button
										variant="default"
										component="a"
										href={idpAdminUrl}
										target="_blank"
										rel="noreferrer"
										rightSection={<LuExternalLink size={14} />}
									>
										Manage SSO users
									</Button>
								)}
								{localEnabled && (
									<Can rule={Permission.UsersWrite}>
										<Button leftSection={<LuPlus size={16} />} onClick={() => show('new')}>
											New user
										</Button>
									</Can>
								)}
							</Group>
						</Group>

						<UserFilters value={{ search, source, status, roles }} onChange={handleFilterChange} />

						{renderResults()}

						{result && result.total > 0 && (
							<PaginationBar
								page={result.page}
								perPage={result.per_page}
								total={result.total}
								totalPages={result.total_pages}
								onPageChange={(next) => setParams({ page: next })}
								onPerPageChange={(value) => setParams({ perPage: value, page: null })}
							/>
						)}
					</Stack>
				</div>
			</ScrollArea>

			{panelOpen && (
				<MainLayoutPanel side="right" w={PANEL_WIDTH} drawerBelow="md">
					<UserPanel
						id={creating ? null : selectedId}
						fallback={selected}
						onClose={() => guard(() => setPanel(null))}
						onCreated={(user) => setPanel({ id: user.id })}
						onDirtyChange={handleDirtyChange}
						onResendVerification={account.resend}
						onDisable={account.disable}
						onEnable={account.enable}
					/>
				</MainLayoutPanel>
			)}

			<UserDisableModal {...account.disableModalProps} />
			<UserEnableModal {...account.enableModalProps} />
			<UnsavedChangesModal blocker={blocker} />
			<Modal opened={!!pendingAction} onClose={() => setPendingAction(null)} title="Discard changes?" centered>
				<Text fz="sm" c="dimmed">
					You have unsaved changes to this user. If you continue, they'll be lost.
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
