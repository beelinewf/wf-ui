import React from 'react';

import { Anchor, Button, Group, Modal, Paper, ScrollArea, Stack, Text, Title } from '@mantine/core';
import { LuArrowLeft } from 'react-icons/lu';
import { Link, type Blocker } from 'react-router';

import classes from './EditorPage.module.scss';

const MAX_WIDTH = 880;

interface EditorPageProps {
	backTo: string;
	backLabel: string;
	title: React.ReactNode;
	subtitle?: React.ReactNode;
	/** Save / Cancel, kept in the sticky header so they stay reachable on a long form. */
	actions?: React.ReactNode;
	children: React.ReactNode;
}

/** A single-column create/edit page: a sticky header with back link and actions over a stack of sections. */
export const EditorPage: React.FC<EditorPageProps> = ({ backTo, backLabel, title, subtitle, actions, children }) => (
	<ScrollArea h="100%" className={classes.canvas}>
		<div className={classes.header}>
			<Group
				justify="space-between"
				align="flex-end"
				gap="sm"
				px={{ base: 'md', md: 'xl' }}
				py="md"
				maw={MAX_WIDTH}
				mx="auto"
			>
				<div style={{ minWidth: 0 }}>
					<Anchor component={Link} to={backTo} fz="xs" c="dimmed">
						<Group gap={4} component="span" display="inline-flex">
							<LuArrowLeft size={12} aria-hidden />
							{backLabel}
						</Group>
					</Anchor>
					<Title order={2} fz={22}>
						{title}
					</Title>
					{subtitle && (
						<Text fz="sm" c="dimmed">
							{subtitle}
						</Text>
					)}
				</div>
				{actions && <Group gap="xs">{actions}</Group>}
			</Group>
		</div>
		<Stack gap="lg" p={{ base: 'md', md: 'xl' }} maw={MAX_WIDTH} mx="auto">
			{children}
		</Stack>
	</ScrollArea>
);

interface EditorSectionProps {
	title: React.ReactNode;
	description?: React.ReactNode;
	/** Rendered beside the title, e.g. a count or a toggle. */
	aside?: React.ReactNode;
	danger?: boolean;
	children: React.ReactNode;
}

export const EditorSection: React.FC<EditorSectionProps> = ({ title, description, aside, danger, children }) => (
	<Paper withBorder radius="md" p="lg" className={danger ? classes.danger : undefined}>
		<Stack gap="md">
			<Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
				<div>
					<Title order={3} fz="md" c={danger ? 'red.7' : undefined}>
						{title}
					</Title>
					{description && (
						<Text c="dimmed" fz="sm">
							{description}
						</Text>
					)}
				</div>
				{aside}
			</Group>
			{children}
		</Stack>
	</Paper>
);

/** The "Leave without saving?" prompt a `useBlocker` guard opens, as the other editors show it. */
export const UnsavedChangesModal: React.FC<{ blocker: Blocker }> = ({ blocker }) => (
	<Modal
		opened={blocker.state === 'blocked'}
		onClose={() => blocker.reset?.()}
		title="Leave without saving?"
		centered
	>
		<Text fz="sm" c="dimmed">
			You have unsaved changes. If you leave this page, they'll be lost.
		</Text>
		<Group justify="flex-end" mt="lg" gap="xs">
			<Button variant="default" onClick={() => blocker.reset?.()}>
				Stay
			</Button>
			<Button color="red" onClick={() => blocker.proceed?.()}>
				Leave without saving
			</Button>
		</Group>
	</Modal>
);
