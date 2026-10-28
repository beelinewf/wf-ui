import React, { useState } from 'react';

import { ActionIcon, Button, Group, ScrollArea, Stack, Text, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { LuCircleAlert, LuExternalLink, LuRefreshCw, LuUsers } from 'react-icons/lu';

import { config } from '@config/config';

import { PaginationBar, PER_PAGE_OPTIONS } from '@common/component/PaginationBar';
import { useAsyncQuery } from '@common/hooks/useAsyncQuery';

import { UserDetailDrawer } from '@module/user/components/UserDetailDrawer';
import { UserTable } from '@module/user/components/UserTable';
import { useListUsersQuery } from '@module/user/hooks';
import type { User } from '@module/user/types/User';

import classes from './UserListPage.module.scss';

export const UserListPage: React.FC = () => {
	const [page, setPage] = useState(1);
	const [perPage, setPerPage] = useState(PER_PAGE_OPTIONS[0]);
	const [selected, setSelected] = useState<User | null>(null);

	const { data: result, isFetching, isError, refetch } = useListUsersQuery({ page, perPage });
	const { data: appConfig } = useAsyncQuery(() => config.getValue(), null);
	const idpAdminUrl = appConfig?.BEELINE_UI_IDP_ADMIN_URL;

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

		if (result.items.length === 0) {
			return (
				<Stack align="center" gap="xs" py={48}>
					<ThemeIcon size={48} radius="xl" variant="light" color="gray">
						<LuUsers size={22} />
					</ThemeIcon>
					<Text fw={600}>No users yet</Text>
					<Text fz="sm" c="dimmed" ta="center" maw={360}>
						A user is added here the first time they sign in through the identity provider.
					</Text>
				</Stack>
			);
		}

		return (
			<div className={classes.results} data-loading={isFetching || undefined} aria-busy={isFetching}>
				<UserTable users={result.items} onSelect={setSelected} />
			</div>
		);
	};

	return (
		<ScrollArea h="100%" className={classes.canvas}>
			<Stack gap="lg" p={{ base: 'md', md: 'xl' }} maw={1180} mx="auto">
				<Group justify="space-between" align="flex-end" gap="sm">
					<div>
						<Title order={2} fz={22}>
							Users
						</Title>
						<Text fz="sm" c="dimmed">
							Everyone who has signed in, newest first. Accounts and role assignments live in the identity
							provider.
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
								Manage users
							</Button>
						)}
					</Group>
				</Group>

				{renderResults()}

				{result && result.total > 0 && (
					<PaginationBar
						page={result.page}
						perPage={result.per_page}
						total={result.total}
						totalPages={result.total_pages}
						onPageChange={setPage}
						onPerPageChange={(value) => {
							setPerPage(value);
							setPage(1);
						}}
					/>
				)}
			</Stack>

			<UserDetailDrawer user={selected} onClose={() => setSelected(null)} />
		</ScrollArea>
	);
};
