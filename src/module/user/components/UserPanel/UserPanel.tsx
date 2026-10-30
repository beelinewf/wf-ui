import React, { useEffect, useState } from 'react';

import {
	ActionIcon,
	Alert,
	Anchor,
	Avatar,
	Badge,
	Button,
	Center,
	Checkbox,
	Collapse,
	CopyButton,
	Divider,
	Group,
	Loader,
	Modal,
	PasswordInput,
	ScrollArea,
	Stack,
	Switch,
	Text,
	TextInput,
	ThemeIcon,
	Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { skipToken } from '@reduxjs/toolkit/query';
import dayjs from 'dayjs';
import {
	LuCheck,
	LuCircleAlert,
	LuCopy,
	LuInfo,
	LuMailCheck,
	LuSave,
	LuTriangleAlert,
	LuUserCheck,
	LuUserRoundX,
	LuUserX,
	LuX,
} from 'react-icons/lu';
import { Link } from 'react-router';

import { queryErrorCode, queryErrorMessage } from '@core/api';
import { Permission, useCan, WILDCARD_PERMISSION } from '@core/auth/authorization';
import { PasswordRequirements } from '@core/auth/components/PasswordRequirements';
import { useGetAuthConfigQuery, useMe } from '@core/auth/hooks';

import { useNotify } from '@module/notification/hooks';
import { useListRolesQuery } from '@module/role/hooks';
import { UserRoles, UserSourceBadge, UserStatusBadge } from '@module/user/components/UserBadges';
import {
	userCreateFromDto,
	userInitialValues,
	userSchema,
	userToDto,
	userUpdateFromDto,
	type UserDto,
} from '@module/user/dto';
import { useCreateUserMutation, useGetUserQuery, useUpdateUserMutation, useUserRoleOptions } from '@module/user/hooks';
import type { User } from '@module/user/types/User';
import { isSystemUser, userDisplayName } from '@module/user/utils';

import classes from './UserPanel.module.scss';

// Losing either leaves the caller unable to manage users or roles, so dropping a role that grants them asks first.
const ADMIN_PERMISSIONS = new Set<string>([Permission.UsersWrite, Permission.RolesWrite, WILDCARD_PERMISSION]);

const formatTime = (value: string) => dayjs(value).format('DD MMM YYYY HH:mm');

/** Picks the field a 422 detail is about, so it shows under that input rather than in a banner. */
const fieldOfDetail = (message: string): keyof UserDto | null => {
	const lower = message.toLowerCase();
	if (lower.includes('password')) return 'password';
	if (lower.includes('email')) return 'email';
	if (lower.includes('name')) return 'name';
	return null;
};

interface UserPanelActions {
	onResendVerification: (user: User) => void;
	onDisable: (user: User) => void;
	onEnable: (user: User) => void;
}

interface UserPanelProps extends UserPanelActions {
	/** The user to show and edit; `null` creates one. */
	id: string | null;
	/** The list's entry for `id`, shown until the detail request lands. */
	fallback?: User;
	onClose: () => void;
	onCreated: (user: User) => void;
	/** Reports unsaved edits, so the list can confirm before switching users or closing. */
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

const IdentityField: React.FC<{ label: string; value: string | null | undefined; copyable?: boolean }> = ({
	label,
	value,
	copyable,
}) => (
	<div>
		<Text fz="xs" c="dimmed">
			{label}
		</Text>
		<Group gap={4} wrap="nowrap">
			<Text fz="sm" ff="monospace" c={value ? undefined : 'dimmed'} style={{ wordBreak: 'break-all' }}>
				{value || 'None'}
			</Text>
			{copyable && value && (
				<CopyButton value={value} timeout={1500}>
					{({ copied, copy }) => (
						<Tooltip label={copied ? 'Copied' : `Copy ${label.toLowerCase()}`}>
							<ActionIcon
								variant="subtle"
								size="sm"
								color={copied ? 'teal' : 'gray'}
								onClick={copy}
								aria-label={`Copy ${label.toLowerCase()}`}
							>
								{copied ? <LuCheck size={14} /> : <LuCopy size={14} />}
							</ActionIcon>
						</Tooltip>
					)}
				</CopyButton>
			)}
		</Group>
	</div>
);

const UserSummary: React.FC<{ user: User }> = ({ user }) => (
	<Stack gap="sm">
		<Group gap="sm" wrap="nowrap">
			<Avatar radius="xl" size="lg" color="initials" name={userDisplayName(user)} />
			<div style={{ minWidth: 0 }}>
				<Text fw={600} truncate>
					{userDisplayName(user)}
				</Text>
				<Text fz="sm" c="dimmed" truncate>
					{user.email || 'No email'}
				</Text>
			</div>
		</Group>
		<Group gap="xs">
			<UserSourceBadge user={user} />
			<UserStatusBadge user={user} />
		</Group>
	</Stack>
);

const UserIdentity: React.FC<{ user: User }> = ({ user }) => (
	<>
		<Divider label="Identity" labelPosition="left" />
		<Stack gap="sm">
			<IdentityField label="User id" value={user.id} copyable />
			<IdentityField label="Subject" value={user.subject} copyable />
			<IdentityField label="Issuer" value={user.issuer} />
		</Stack>
		<Divider />
		<Group gap="xl">
			<div>
				<Text fz="xs" c="dimmed">
					Joined
				</Text>
				<Text fz="sm">{formatTime(user.created_at)}</Text>
			</div>
			<div>
				<Text fz="xs" c="dimmed">
					Updated
				</Text>
				<Text fz="sm">{formatTime(user.updated_at)}</Text>
			</div>
		</Group>
	</>
);

const RefreshFailed: React.FC = () => (
	<Alert color="red" variant="light" icon={<LuCircleAlert size={16} />} p="xs">
		Couldn't refresh this user; showing the list entry.
	</Alert>
);

const RolesField: React.FC<{ value: string[]; onChange: (value: string[]) => void }> = ({ value, onChange }) => {
	const { options, isLoading } = useUserRoleOptions();
	// A stored role the catalog no longer has is kept visible so it can be removed.
	const names = new Set(options.map((option) => option.name));
	const all = [...options, ...value.filter((role) => !names.has(role)).map((name) => ({ name, description: null }))];

	if (isLoading) return <Loader size="sm" />;
	if (all.length === 0) {
		return (
			<Text fz="sm" c="dimmed">
				No roles exist yet. Create one on the Roles page first.
			</Text>
		);
	}

	return (
		<Checkbox.Group value={value} onChange={onChange}>
			<Stack gap="xs">
				{all.map((role) => (
					<Checkbox
						key={role.name}
						value={role.name}
						label={
							<Text fz="sm" ff="monospace" fw={600}>
								{role.name}
								{!names.has(role.name) && (
									<Badge ml={6} size="xs" color="yellow" variant="light" ff="body">
										Not in catalog
									</Badge>
								)}
							</Text>
						}
						description={role.description || undefined}
					/>
				))}
			</Stack>
		</Checkbox.Group>
	);
};

/** Read-only: SSO and system users, or a caller without users:write. */
const UserDetail: React.FC<{
	user: User;
	fetching?: boolean;
	refreshFailed?: boolean;
	note?: React.ReactNode;
	onClose: () => void;
}> = ({ user, fetching, refreshFailed, note, onClose }) => (
	<div className={classes.root}>
		<PanelHeader title={userDisplayName(user)} loading={fetching} onClose={onClose} />
		<ScrollArea className={classes.body}>
			<Stack gap="md" p="md">
				<UserSummary user={user} />
				{refreshFailed && <RefreshFailed />}
				{note}
				<Divider label="Roles" labelPosition="left" />
				{user.is_local ? (
					<UserRoles user={user} />
				) : (
					<Alert color="blue" variant="light" icon={<LuInfo size={16} />} p="xs">
						<Text fz="sm">
							Roles aren't stored on SSO users. They're read from the identity provider's token each time
							the user signs in.
						</Text>
					</Alert>
				)}
				<UserIdentity user={user} />
			</Stack>
		</ScrollArea>
	</div>
);

interface UserFormProps extends UserPanelActions {
	/** The stored local user when editing; absent when creating. */
	user?: User;
	verificationEnabled: boolean;
	fetching?: boolean;
	refreshFailed?: boolean;
	onClose: () => void;
	onCreated: (user: User) => void;
	onDirtyChange: (dirty: boolean) => void;
}

/** Profile, roles and account state of a local user in one place. */
const UserForm: React.FC<UserFormProps> = ({
	user,
	verificationEnabled,
	fetching,
	refreshFailed,
	onClose,
	onCreated,
	onDirtyChange,
	onResendVerification,
	onDisable,
	onEnable,
}) => {
	const editing = !!user;
	const notify = useNotify();
	const { data: me } = useMe();
	const canReadRoles = useCan(Permission.RolesRead);
	const { data: roleCatalog } = useListRolesQuery(undefined, { skip: !canReadRoles });
	const [createUser, createState] = useCreateUserMutation();
	const [updateUser, updateState] = useUpdateUserMutation();
	const [saveError, setSaveError] = useState<string | null>(null);
	const [pendingSelfDemotion, setPendingSelfDemotion] = useState<UserDto | null>(null);

	const self = !!user && user.id === me?.id;
	const system = !!user && isSystemUser(user);

	const form = useForm<UserDto>({
		mode: 'controlled',
		initialValues: user ? userToDto(user) : userInitialValues,
		validate: (values) => {
			const result = userSchema.safeParse(values);
			if (result.success) return {};

			return Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
		},
	});

	// A refetch of the stored user (e.g. after a disable, or a save elsewhere) resets a form nobody has touched yet.
	useEffect(() => {
		if (!user || form.isDirty()) return;
		form.setValues(userToDto(user));
		form.resetDirty(userToDto(user));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user]);

	const dirty = form.isDirty();
	useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
	useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

	const values = form.values;
	const emailChanged = !!user && values.email.trim().toLowerCase() !== user.email.toLowerCase();
	const saving = createState.isLoading || updateState.isLoading;

	/** Own roles being dropped that grant users:write or roles:write, when the rest no longer do. */
	const losesAdminAccess = (next: UserDto) => {
		if (!self || !user || !roleCatalog) return false;
		const grantsAdmin = (name: string) =>
			roleCatalog.items.find((role) => role.name === name)?.permissions.some((p) => ADMIN_PERMISSIONS.has(p));
		const removed = user.roles.filter((role) => !next.roles.includes(role));
		return removed.some(grantsAdmin) && !next.roles.some(grantsAdmin);
	};

	const save = async (next: UserDto) => {
		setSaveError(null);
		try {
			if (user) {
				const payload = userUpdateFromDto(user, next, { canWrite: true, verificationEnabled });
				const saved = await updateUser({ id: user.id, payload, self }).unwrap();
				form.setValues(userToDto(saved));
				form.resetDirty(userToDto(saved));
				notify.success({ title: 'User saved', message: `${userDisplayName(saved)} saved` });
			} else {
				const created = await createUser(userCreateFromDto(next)).unwrap();
				form.resetDirty();
				notify.success({ title: 'User created', message: `${userDisplayName(created)} can sign in now` });
				onCreated(created);
			}
		} catch (error) {
			const code = queryErrorCode(error);
			const message = queryErrorMessage(error, 'Failed to save the user');
			const field = code === 422 ? fieldOfDetail(message) : null;
			if (code === 409) form.setFieldError('email', 'An account with this email already exists');
			else if (field) form.setFieldError(field, message);
			else setSaveError(message);
		}
	};

	const handleSubmit = async (next: UserDto) => {
		if (losesAdminAccess(next)) {
			setPendingSelfDemotion(next);
			return;
		}
		await save(next);
	};

	// The modal sits outside the form: React bubbles a portal's submit to its tree parent, so a nested confirm form
	// would also save the user.
	return (
		<>
			<form onSubmit={form.onSubmit(handleSubmit)} noValidate className={classes.root}>
				<PanelHeader title={user ? userDisplayName(user) : 'New user'} loading={fetching} onClose={onClose} />

				<ScrollArea className={classes.body}>
					<Stack gap="md" p="md">
						{user ? (
							<UserSummary user={user} />
						) : (
							<Text fz="sm" c="dimmed">
								Create a local account that signs in with an email and password. It is verified and
								active at once.
							</Text>
						)}

						{self && (
							<Alert color="yellow" variant="light" icon={<LuTriangleAlert size={16} />} p="xs">
								This is your own account. Change your password from{' '}
								<Anchor component={Link} to="/app/settings/password" fz="sm">
									Settings → Password
								</Anchor>
								, which asks for your current one.
							</Alert>
						)}

						{refreshFailed && <RefreshFailed />}

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

						<Divider label="Profile" labelPosition="left" />
						<TextInput
							label="Name"
							withAsterisk
							autoComplete="off"
							data-autofocus={!editing || undefined}
							{...form.getInputProps('name')}
						/>
						<TextInput
							label="Email"
							description="Used to sign in. Stored lowercased."
							type="email"
							withAsterisk
							autoComplete="off"
							{...form.getInputProps('email')}
						/>
						{emailChanged && verificationEnabled && values.emailVerified && (
							<Checkbox
								label="Keep as verified"
								description="Otherwise the new address must be verified before the next sign-in."
								{...form.getInputProps('keepVerified', { type: 'checkbox' })}
							/>
						)}

						{editing && !self && (
							<Switch
								label="Set a new password"
								{...form.getInputProps('changePassword', { type: 'checkbox' })}
							/>
						)}
						<Collapse expanded={!editing || (values.changePassword && !self)}>
							<Stack gap="md">
								<Stack gap={6}>
									<PasswordInput
										label={editing ? 'New password' : 'Password'}
										withAsterisk
										autoComplete="new-password"
										{...form.getInputProps('password')}
									/>
									<PasswordRequirements password={values.password} />
								</Stack>
								<PasswordInput
									label="Confirm password"
									withAsterisk
									autoComplete="new-password"
									{...form.getInputProps('confirmPassword')}
								/>
							</Stack>
						</Collapse>

						<Divider label="Roles" labelPosition="left" />
						<Text fz="xs" c="dimmed" mt={-8}>
							What this user can do. Roles replace each other fully on save.
						</Text>
						<RolesField value={values.roles} onChange={(roles) => form.setFieldValue('roles', roles)} />

						{user && (
							<>
								<Divider label="Account" labelPosition="left" />
								<Switch
									label="Email verified"
									description={
										values.emailVerified
											? 'The user can sign in with this address.'
											: 'The user must open the mailed link before signing in.'
									}
									{...form.getInputProps('emailVerified', { type: 'checkbox' })}
								/>
								{!user.email_verified && user.is_active && (
									<Group>
										<Button
											variant="light"
											size="xs"
											leftSection={<LuMailCheck size={14} />}
											onClick={() => onResendVerification(user)}
										>
											Resend verification
										</Button>
									</Group>
								)}

								<UserIdentity user={user} />
							</>
						)}
					</Stack>
				</ScrollArea>

				<div className={classes.footer}>
					{user && !self && !system ? (
						user.is_active ? (
							<Tooltip label="Disable user">
								<ActionIcon
									variant="subtle"
									color="red"
									size={36}
									onClick={() => onDisable(user)}
									aria-label={`Disable ${userDisplayName(user)}`}
								>
									<LuUserX size={16} />
								</ActionIcon>
							</Tooltip>
						) : (
							<Tooltip label="Re-enable user">
								<ActionIcon
									variant="subtle"
									color="gray"
									size={36}
									onClick={() => onEnable(user)}
									aria-label={`Re-enable ${userDisplayName(user)}`}
								>
									<LuUserCheck size={16} />
								</ActionIcon>
							</Tooltip>
						)
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
				opened={!!pendingSelfDemotion}
				onClose={() => setPendingSelfDemotion(null)}
				title="Remove your own admin access?"
				centered
			>
				<Text fz="sm">
					The roles you're removing are the ones that let you manage users or roles. After saving you won't be
					able to undo this yourself.
				</Text>
				<Group justify="flex-end" mt="lg" gap="xs">
					<Button variant="default" onClick={() => setPendingSelfDemotion(null)}>
						Keep my access
					</Button>
					<Button
						color="red"
						onClick={() => {
							const next = pendingSelfDemotion;
							setPendingSelfDemotion(null);
							if (next) void save(next);
						}}
					>
						Remove and save
					</Button>
				</Group>
			</Modal>
		</>
	);
};

const PanelLoading: React.FC<{ title: React.ReactNode; onClose: () => void }> = ({ title, onClose }) => (
	<div className={classes.root}>
		<PanelHeader title={title} onClose={onClose} />
		<Center className={classes.body}>
			<Loader size="sm" />
		</Center>
	</div>
);

const PanelNotice: React.FC<{
	title: React.ReactNode;
	icon: React.ReactNode;
	color?: string;
	heading: string;
	children?: React.ReactNode;
	onClose: () => void;
}> = ({ title, icon, color = 'gray', heading, children, onClose }) => (
	<div className={classes.root}>
		<PanelHeader title={title} onClose={onClose} />
		<Center className={classes.body} p="md">
			<Stack align="center" gap="xs" ta="center">
				<ThemeIcon size={48} radius="xl" variant="light" color={color}>
					{icon}
				</ThemeIcon>
				<Text fw={600}>{heading}</Text>
				{children && (
					<Text fz="sm" c="dimmed">
						{children}
					</Text>
				)}
			</Stack>
		</Center>
	</div>
);

/**
 * A user's detail and editor in one panel, or the form for a new local user when `id` is `null`. Only local users
 * are edited here; SSO and system users, and callers without users:write, get the read-only detail.
 */
export const UserPanel: React.FC<UserPanelProps> = ({ id, fallback, ...props }) => {
	const canWrite = useCan(Permission.UsersWrite);
	const { data: authConfig } = useGetAuthConfigQuery();
	const { data, isFetching, isError, error } = useGetUserQuery(id ?? skipToken);
	const localEnabled = !!authConfig?.local_enabled;
	const verificationEnabled = !!authConfig?.email_verification_enabled;

	if (id === null) {
		if (!authConfig) return <PanelLoading title="New user" onClose={props.onClose} />;
		if (!localEnabled) {
			return (
				<PanelNotice title="New user" icon={<LuInfo size={22} />} heading="Local accounts are off" {...props}>
					This engine only signs users in through SSO, so users are managed in the identity provider.
				</PanelNotice>
			);
		}
		return <UserForm verificationEnabled={verificationEnabled} {...props} />;
	}

	const user = data && data.id === id ? data : fallback;

	if (!user) {
		if (!isError) return <PanelLoading title="User" onClose={props.onClose} />;

		const missing = queryErrorCode(error) === 404 || queryErrorCode(error) === 422;
		return (
			<PanelNotice
				title="User"
				icon={missing ? <LuUserRoundX size={22} /> : <LuCircleAlert size={22} />}
				color={missing ? 'gray' : 'red'}
				heading={missing ? 'User not found' : "Couldn't load this user"}
				{...props}
			>
				{missing
					? 'No user has this id. They may have been removed.'
					: queryErrorMessage(error, 'Something went wrong')}
			</PanelNotice>
		);
	}

	if (!canWrite || !user.is_local || !localEnabled) {
		const note =
			canWrite && !user.is_local && !isSystemUser(user) ? (
				<Alert color="blue" variant="light" icon={<LuInfo size={16} />} p="xs">
					<Text fz="sm">
						{userDisplayName(user)} signs in with SSO. Their profile and roles come from the identity
						provider, so there is nothing to edit here.
					</Text>
				</Alert>
			) : null;
		return (
			<UserDetail user={user} fetching={isFetching} refreshFailed={isError} note={note} onClose={props.onClose} />
		);
	}

	// Keyed by id so moving between two users never carries one form into the other.
	return (
		<UserForm
			key={user.id}
			user={user}
			verificationEnabled={verificationEnabled}
			fetching={isFetching}
			refreshFailed={isError}
			{...props}
		/>
	);
};
