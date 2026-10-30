import React, { useEffect, useState } from 'react';

import {
	ActionIcon,
	Alert,
	Button,
	Center,
	Divider,
	Group,
	Loader,
	Modal,
	ScrollArea,
	Stack,
	Switch,
	Text,
	Textarea,
	TextInput,
	ThemeIcon,
	Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { skipToken } from '@reduxjs/toolkit/query';
import dayjs from 'dayjs';
import { LuCircleAlert, LuSave, LuShieldAlert, LuShieldQuestion, LuTrash2, LuTriangleAlert, LuX } from 'react-icons/lu';

import { queryErrorCode, queryErrorMessage } from '@core/api';
import { Permission, useCan, WILDCARD_PERMISSION } from '@core/auth/authorization';
import { useMe } from '@core/auth/hooks';

import { useNotify } from '@module/notification/hooks';
import { PermissionList } from '@module/role/components/PermissionList';
import { RolePermissionPicker } from '@module/role/components/RolePermissionPicker';
import { PERMISSION_GROUPS } from '@module/role/constant';
import {
	roleCreateFromDto,
	roleInitialValues,
	roleSchema,
	roleToDto,
	roleUpdateFromDto,
	type RoleDto,
} from '@module/role/dto';
import { useCreateRoleMutation, useGetRoleQuery, useUpdateRoleMutation } from '@module/role/hooks';
import type { Role } from '@module/role/types/Role';
import { hasWildcard, holdsRole } from '@module/role/utils';

import classes from './RolePanel.module.scss';

const ALL_KNOWN_PERMISSIONS: string[] = PERMISSION_GROUPS.flatMap((group) => group.permissions);

const formatTime = (value: string) => dayjs(value).format('DD MMM YYYY HH:mm');

interface RolePanelProps {
	/** The role to show and edit; `null` creates one. */
	name: string | null;
	/** The list's entry for `name`, shown until the detail request lands. */
	fallback?: Role;
	onClose: () => void;
	onCreated: (role: Role) => void;
	onDelete: (role: Role) => void;
	/** Reports unsaved edits, so the list can confirm before switching roles or closing. */
	onDirtyChange: (dirty: boolean) => void;
}

const PanelHeader: React.FC<{ title: React.ReactNode; loading?: boolean; onClose: () => void }> = ({
	title,
	loading,
	onClose,
}) => (
	<div className={classes.header}>
		<Group gap="xs" wrap="nowrap" className={classes.headerTitle}>
			<Text fw={600} truncate>
				{title}
			</Text>
			{loading && <Loader size={14} color="gray" />}
		</Group>
		<ActionIcon variant="subtle" color="gray" onClick={onClose} aria-label="Close">
			<LuX size={16} />
		</ActionIcon>
	</div>
);

const RoleTimes: React.FC<{ role: Role }> = ({ role }) => (
	<Group gap="xl">
		<div>
			<Text fz="xs" c="dimmed">
				Created
			</Text>
			<Text fz="sm">{formatTime(role.created_at)}</Text>
		</div>
		<div>
			<Text fz="xs" c="dimmed">
				Updated
			</Text>
			<Text fz="sm">{formatTime(role.updated_at)}</Text>
		</div>
	</Group>
);

interface RoleFormProps extends Omit<RolePanelProps, 'name' | 'fallback'> {
	/** The stored role when editing; absent when creating. */
	role?: Role;
	fetching?: boolean;
	refreshFailed?: boolean;
}

/** Details and permissions in one place: editable with roles:write, read-only without. */
const RoleForm: React.FC<RoleFormProps> = ({
	role,
	fetching,
	refreshFailed,
	onClose,
	onCreated,
	onDelete,
	onDirtyChange,
}) => {
	const editing = !!role;
	const canWrite = useCan(Permission.RolesWrite);
	const notify = useNotify();
	const { data: me } = useMe();
	const [createRole, createState] = useCreateRoleMutation();
	const [updateRole, updateState] = useUpdateRoleMutation();
	const [saveError, setSaveError] = useState<string | null>(null);
	const [narrowOpened, setNarrowOpened] = useState(false);

	const form = useForm<RoleDto>({
		mode: 'controlled',
		initialValues: role ? roleToDto(role) : roleInitialValues,
		validate: (values) => {
			const result = roleSchema.safeParse(values);
			if (result.success) return {};

			return Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
		},
	});

	// A refetch of the stored role (e.g. after another tab saved it) resets a form nobody has touched yet.
	useEffect(() => {
		if (!role || form.isDirty()) return;
		form.setValues(roleToDto(role));
		form.resetDirty(roleToDto(role));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [role]);

	const dirty = form.isDirty();
	useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
	useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

	const permissions = form.values.permissions;
	const wildcard = hasWildcard(permissions);
	const ownRole = !!role && holdsRole(me?.roles, role.name);
	const saving = createState.isLoading || updateState.isLoading;

	const setWildcard = (on: boolean) => {
		if (on)
			form.setFieldValue('permissions', [
				...permissions.filter((p) => p !== WILDCARD_PERMISSION),
				WILDCARD_PERMISSION,
			]);
		else setNarrowOpened(true);
	};

	// Narrowing starts from everything ticked, so the editor removes what the role should lose.
	const narrowWildcard = () => {
		const rest = permissions.filter((permission) => permission !== WILDCARD_PERMISSION);
		form.setFieldValue('permissions', [...new Set([...ALL_KNOWN_PERMISSIONS, ...rest])]);
		setNarrowOpened(false);
	};

	const handleSubmit = async (values: RoleDto) => {
		setSaveError(null);
		try {
			if (role) {
				const saved = await updateRole({ name: role.name, payload: roleUpdateFromDto(values) }).unwrap();
				form.setValues(roleToDto(saved));
				form.resetDirty(roleToDto(saved));
				notify.success({ title: 'Role saved', message: `Role ${saved.name} saved` });
			} else {
				const created = await createRole(roleCreateFromDto(values)).unwrap();
				form.resetDirty();
				notify.success({ title: 'Role created', message: `Role ${created.name} created` });
				onCreated(created);
			}
		} catch (error) {
			const code = queryErrorCode(error);
			if (!role && code === 409) {
				form.setFieldError('name', 'A role with this name already exists');
			} else if (code === 409) {
				setSaveError(queryErrorMessage(error, 'At least one role must keep the roles:write permission.'));
			} else if (code === 404) {
				setSaveError('This role no longer exists. It may have been deleted elsewhere.');
			} else {
				setSaveError(queryErrorMessage(error, 'Failed to save the role'));
			}
		}
	};

	const grantedCount = wildcard
		? ALL_KNOWN_PERMISSIONS.length
		: permissions.filter((permission) => ALL_KNOWN_PERMISSIONS.includes(permission)).length;

	const title = editing ? (
		<Text span inherit ff="monospace">
			{role.name}
		</Text>
	) : (
		'New role'
	);

	if (!canWrite && role) {
		return (
			<div className={classes.root}>
				<PanelHeader title={title} loading={fetching} onClose={onClose} />
				<ScrollArea className={classes.body}>
					<Stack gap="md" p="md">
						<Text fz="sm" c={role.description ? undefined : 'dimmed'}>
							{role.description || 'No description.'}
						</Text>
						{refreshFailed && (
							<Alert color="red" variant="light" icon={<LuCircleAlert size={16} />} p="xs">
								Couldn't refresh this role; showing the catalog entry.
							</Alert>
						)}
						<Divider label="Permissions" labelPosition="left" />
						<PermissionList permissions={role.permissions} emptyText="This role grants nothing." />
						<Divider />
						<RoleTimes role={role} />
					</Stack>
				</ScrollArea>
			</div>
		);
	}

	// The modal sits outside the form: React bubbles a portal's submit to its tree parent, so a nested confirm form
	// would also save the role.
	return (
		<>
			<form onSubmit={form.onSubmit(handleSubmit)} noValidate className={classes.root}>
				<PanelHeader title={title} loading={fetching} onClose={onClose} />

				<ScrollArea className={classes.body}>
					<Stack gap="md" p="md">
						{ownRole && (
							<Alert color="yellow" variant="light" icon={<LuTriangleAlert size={16} />} p="xs">
								You hold this role. Saving changes your own access, and you may lose the ability to edit
								roles.
							</Alert>
						)}

						{refreshFailed && (
							<Alert color="red" variant="light" icon={<LuCircleAlert size={16} />} p="xs">
								Couldn't refresh this role; showing the catalog entry.
							</Alert>
						)}

						{saveError && (
							<Alert
								color="red"
								variant="light"
								icon={<LuCircleAlert size={16} />}
								p="xs"
								withCloseButton
								onClose={() => setSaveError(null)}
							>
								{saveError}
							</Alert>
						)}

						<TextInput
							label="Name"
							description={
								editing
									? "The name is the role's key and can't be changed."
									: 'The value tokens and the role claim carry, e.g. operator'
							}
							placeholder="operator"
							autoComplete="off"
							spellCheck={false}
							disabled={editing}
							data-autofocus={!editing || undefined}
							withAsterisk={!editing}
							styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
							{...form.getInputProps('name')}
						/>
						<Textarea
							label="Description"
							placeholder="What people with this role do"
							description={editing ? undefined : 'Left blank, it reads "Configured role <name>".'}
							autosize
							minRows={2}
							maxRows={6}
							{...form.getInputProps('description')}
						/>

						<Divider />

						<Group justify="space-between" align="flex-start" wrap="nowrap">
							<div>
								<Text fz="sm" fw={600}>
									Permissions
								</Text>
								<Text fz="xs" c="dimmed">
									{wildcard
										? 'Every action, including ones added to the engine later.'
										: `${grantedCount} of ${ALL_KNOWN_PERMISSIONS.length} granted`}
								</Text>
							</div>
							<Switch
								label="All"
								labelPosition="left"
								checked={wildcard}
								onChange={(event) => setWildcard(event.currentTarget.checked)}
							/>
						</Group>
						{wildcard && (
							<Alert color="violet" variant="light" icon={<LuShieldAlert size={16} />} p="xs">
								<Text fz="sm">
									This role holds{' '}
									<Text span ff="monospace" fz="xs">
										*
									</Text>
									, which grants every action. Turn off "All" to pick specific ones.
								</Text>
							</Alert>
						)}
						<RolePermissionPicker
							value={permissions}
							onChange={(value) => form.setFieldValue('permissions', value)}
							disabled={wildcard}
						/>

						{role && (
							<>
								<Divider />
								<RoleTimes role={role} />
							</>
						)}
					</Stack>
				</ScrollArea>

				<div className={classes.footer}>
					{role ? (
						<Tooltip label="Delete role">
							<ActionIcon
								variant="subtle"
								color="red"
								size={36}
								onClick={() => onDelete(role)}
								aria-label={`Delete role ${role.name}`}
							>
								<LuTrash2 size={16} />
							</ActionIcon>
						</Tooltip>
					) : (
						<span />
					)}
					<Group gap="xs">
						{editing ? (
							<Button variant="default" disabled={!dirty || saving} onClick={() => form.reset()}>
								Discard
							</Button>
						) : (
							<Button variant="default" disabled={saving} onClick={onClose}>
								Cancel
							</Button>
						)}
						<Button
							type="submit"
							leftSection={<LuSave size={16} />}
							loading={saving}
							disabled={editing && !dirty}
						>
							{editing ? 'Save' : 'Create'}
						</Button>
					</Group>
				</div>
			</form>

			<Modal
				opened={narrowOpened}
				onClose={() => setNarrowOpened(false)}
				title="Pick specific permissions?"
				centered
			>
				<Text fz="sm">
					The role will stop granting{' '}
					<Text span ff="monospace" fz="xs">
						*
					</Text>
					. Every permission this UI knows starts ticked; untick the ones the role should lose. Actions added
					to the engine later won't be granted automatically.
				</Text>
				<Group justify="flex-end" mt="lg" gap="xs">
					<Button variant="default" onClick={() => setNarrowOpened(false)}>
						Keep all permissions
					</Button>
					<Button color="yellow" onClick={narrowWildcard}>
						Pick specific permissions
					</Button>
				</Group>
			</Modal>
		</>
	);
};

/** A role's detail and editor in one panel, or the form for a new role when `name` is `null`. */
export const RolePanel: React.FC<RolePanelProps> = ({ name, fallback, ...props }) => {
	const { data, isFetching, isError, error } = useGetRoleQuery(name ?? skipToken);

	if (name === null) return <RoleForm {...props} />;

	const role = data && data.name === name ? data : fallback;

	if (!role) {
		if (!isError) {
			return (
				<div className={classes.root}>
					<PanelHeader title={name} onClose={props.onClose} />
					<Center className={classes.body}>
						<Loader size="sm" />
					</Center>
				</div>
			);
		}

		const missing = queryErrorCode(error) === 404 || queryErrorCode(error) === 422;
		return (
			<div className={classes.root}>
				<PanelHeader title={name} onClose={props.onClose} />
				<Center className={classes.body} p="md">
					<Stack align="center" gap="xs" ta="center">
						<ThemeIcon size={48} radius="xl" variant="light" color={missing ? 'gray' : 'red'}>
							{missing ? <LuShieldQuestion size={22} /> : <LuCircleAlert size={22} />}
						</ThemeIcon>
						<Text fw={600}>{missing ? 'Role not found' : "Couldn't load this role"}</Text>
						<Text fz="sm" c="dimmed">
							{missing ? 'It may have been deleted.' : queryErrorMessage(error, 'Something went wrong')}
						</Text>
					</Stack>
				</Center>
			</div>
		);
	}

	// Keyed by name so moving between two roles never carries one form into the other.
	return <RoleForm key={name} role={role} fetching={isFetching} refreshFailed={isError} {...props} />;
};
