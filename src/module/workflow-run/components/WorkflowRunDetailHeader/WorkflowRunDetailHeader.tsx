import React from 'react';

import { ActionIcon, Alert, Anchor, Badge, Button, Group, Switch, Text, Title, Tooltip } from '@mantine/core';
import {
	LuArrowLeft,
	LuBell,
	LuBellRing,
	LuBug,
	LuGitBranchPlus,
	LuHourglass,
	LuPanelLeft,
	LuPanelRight,
	LuPause,
	LuPlay,
	LuSquare,
	LuStepForward,
	LuTriangleAlert,
	LuUndo2,
} from 'react-icons/lu';
import { Link } from 'react-router';

import { Permission, useCan } from '@core/auth/authorization';

import { useAppLayoutPanel } from '@module/app/hooks';
import { useRunWatch } from '@module/notification/hooks';
import { isTerminalRunStatus } from '@module/notification/utils';
import type { WorkflowDefinition } from '@module/workflow-definition/types/WorkflowDefinition';
import type { WorkflowDefinitionNode } from '@module/workflow-definition/types/WorkflowDefinitionNode';
import type { WorkflowRunDebugContext } from '@module/workflow-run/types/WorkflowRunDebugContext';
import type { WorkflowRunDetail } from '@module/workflow-run/types/WorkflowRunDetail';
import { formatWaitingReason, getAllowedActions } from '@module/workflow-run/utils';

import { WorkflowRunIdText } from '../WorkflowRunIdText';
import { WorkflowRunStatusBadge } from '../WorkflowRunStatusBadge';
import classes from './WorkflowRunDetailHeader.module.scss';

interface WorkflowRunDetailHeaderProps {
	/** Null when the caller cannot read definitions. */
	definition: Pick<WorkflowDefinition, 'name' | 'version'> | null;
	detail: WorkflowRunDetail;
	/** The node a run parked on input is waiting at. */
	pendingNode: WorkflowDefinitionNode | null;
	/** Parallel branches parked on an http input while the run waits on their join. */
	branchInputCount?: number;
	/** Where a debug run is paused; null for regular runs or when the engine hides it. */
	debugCursor: WorkflowRunDebugContext | null;
	/** The node at the debug cursor, when it resolves. */
	debugNode: WorkflowDefinitionNode | null;
	onBack: () => void;
	live: boolean;
	onLiveChange: (live: boolean) => void;
	/** Rendered between the title row and the alerts. */
	summary: React.ReactNode;
	pending: { pause: boolean; resume: boolean; stop: boolean; rollback: boolean };
	canRollback: boolean;
	actionError: string | null;
	onDismissActionError: () => void;
	/** Omitted when the caller cannot deliver input. */
	onProvideInput?: () => void;
	onPause: () => void;
	onResume: () => void;
	onRollback: () => void;
	onStop: () => void;
	/** Omitted when the caller cannot migrate runs. */
	onMigrate?: () => void;
}

export const WorkflowRunDetailHeader: React.FC<WorkflowRunDetailHeaderProps> = ({
	definition,
	detail,
	pendingNode,
	branchInputCount = 0,
	debugCursor,
	debugNode,
	onBack,
	live,
	onLiveChange,
	summary,
	pending,
	canRollback,
	actionError,
	onDismissActionError,
	onProvideInput,
	onPause,
	onResume,
	onRollback,
	onStop,
	onMigrate,
}) => {
	const panel = useAppLayoutPanel();
	const canControl = useCan(Permission.InstancesControl);
	const actions = getAllowedActions(detail).filter((action) => (action === 'migrate' ? !!onMigrate : canControl));
	const title = definition?.name ?? 'Workflow run';
	const busy = pending.pause || pending.resume || pending.stop || pending.rollback;
	const runWatch = useRunWatch(detail.id);

	return (
		<div className={classes.root}>
			<Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
				<Group gap="sm" wrap="nowrap" className={classes.headerTitle}>
					<Tooltip label="Back to runs">
						<ActionIcon variant="subtle" color="gray" size={34} aria-label="Back to runs" onClick={onBack}>
							<LuArrowLeft size={18} />
						</ActionIcon>
					</Tooltip>
					<div className={classes.titleBlock}>
						<Group gap={8} wrap="nowrap">
							<Title order={2} fz={20} className={classes.title} title={title}>
								{title}
							</Title>
							{definition && (
								<Badge size="sm" color="gray">
									v{definition.version}
								</Badge>
							)}
							<WorkflowRunStatusBadge run={detail} />
							{detail.debug && (
								<Badge size="sm" color="grape" variant="light" leftSection={<LuBug size={11} />}>
									{debugCursor?.is_debug_paused
										? `Debug · paused at ${debugNode?.name ?? (debugCursor.node_id || 'start')}`
										: 'Debug'}
								</Badge>
							)}
						</Group>
						<Group gap="sm" wrap="nowrap">
							<WorkflowRunIdText id={detail.id} />
							<Text fz="xs" c="dimmed">
								started by {detail.created_by}
							</Text>
							{detail.migrated_from && (
								<Anchor
									component={Link}
									to={`/app/workflow-run/${detail.migrated_from}`}
									fz="xs"
									title={detail.migrated_from}
								>
									Migrated from {detail.migrated_from.slice(0, 8)}
								</Anchor>
							)}
							{detail.superseded_by && (
								<Anchor
									component={Link}
									to={`/app/workflow-run/${detail.superseded_by}`}
									fz="xs"
									title={detail.superseded_by}
								>
									Superseded by {detail.superseded_by.slice(0, 8)}
								</Anchor>
							)}
						</Group>
					</div>
				</Group>

				<Group gap="xs" wrap="nowrap">
					<Switch
						label="Live"
						size="sm"
						checked={live}
						onChange={(event) => onLiveChange(event.currentTarget.checked)}
					/>
					{!isTerminalRunStatus(detail.status) && (
						<Tooltip
							label={runWatch.watching ? 'Stop notifying about this run' : 'Notify me about this run'}
						>
							<ActionIcon
								variant={runWatch.watching ? 'light' : 'default'}
								size={30}
								aria-label={runWatch.watching ? 'Unwatch run' : 'Watch run'}
								aria-pressed={runWatch.watching}
								onClick={() =>
									runWatch.watching
										? runWatch.unwatch()
										: runWatch.watch({
												label: definition
													? `${definition.name} v${definition.version}`
													: undefined,
											})
								}
							>
								{runWatch.watching ? <LuBellRing size={16} /> : <LuBell size={16} />}
							</ActionIcon>
						</Tooltip>
					)}

					{(detail.pending_input || branchInputCount > 0) && onProvideInput && (
						<Button size="sm" leftSection={<LuHourglass size={15} />} onClick={onProvideInput}>
							Provide input
						</Button>
					)}
					{actions.includes('pause') && (
						<Button
							size="sm"
							variant="default"
							leftSection={<LuPause size={15} />}
							loading={pending.pause}
							disabled={busy}
							onClick={onPause}
						>
							Pause
						</Button>
					)}
					{actions.includes('resume') &&
						(detail.debug ? (
							// Every resume of a debug run executes exactly one node.
							<Tooltip label="Run the next node, then pause again">
								<Button
									size="sm"
									variant="light"
									color="grape"
									leftSection={<LuStepForward size={15} />}
									loading={pending.resume}
									disabled={busy}
									onClick={onResume}
								>
									Step
								</Button>
							</Tooltip>
						) : (
							<Button
								size="sm"
								variant="default"
								leftSection={<LuPlay size={15} />}
								loading={pending.resume}
								disabled={busy}
								onClick={onResume}
							>
								Resume
							</Button>
						))}
					{canRollback && (
						<Button
							size="sm"
							variant="default"
							color="grape"
							leftSection={<LuUndo2 size={15} />}
							loading={pending.rollback}
							disabled={busy}
							onClick={onRollback}
						>
							Roll back
						</Button>
					)}
					{actions.includes('migrate') && (
						<Button
							size="sm"
							variant="default"
							leftSection={<LuGitBranchPlus size={15} />}
							disabled={busy}
							onClick={onMigrate}
						>
							Migrate
						</Button>
					)}
					{actions.includes('stop') && (
						<Button
							size="sm"
							variant="light"
							color="red"
							leftSection={<LuSquare size={14} />}
							loading={pending.stop}
							disabled={busy}
							onClick={onStop}
						>
							Stop
						</Button>
					)}

					<Tooltip label={panel.opened.left ? 'Hide context' : 'Show context'}>
						<ActionIcon
							variant="default"
							size={30}
							aria-label="Toggle context panel"
							aria-pressed={panel.opened.left}
							onClick={() => panel.toggle('left')}
						>
							<LuPanelLeft size={16} />
						</ActionIcon>
					</Tooltip>
					<Tooltip label={panel.opened.right ? 'Hide node details' : 'Show node details'}>
						<ActionIcon
							variant="default"
							size={30}
							aria-label="Toggle node details panel"
							aria-pressed={panel.opened.right}
							onClick={() => panel.toggle('right')}
						>
							<LuPanelRight size={16} />
						</ActionIcon>
					</Tooltip>
				</Group>
			</Group>

			{summary}

			{actionError && (
				<Alert
					color="red"
					icon={<LuTriangleAlert size={16} />}
					p="sm"
					withCloseButton
					onClose={onDismissActionError}
				>
					<Text fz="xs">{actionError}</Text>
				</Alert>
			)}

			{detail.error && (
				<Alert color="red" icon={<LuTriangleAlert size={16} />} title="Run failed" p="sm">
					<Text fz="xs" className={classes.mono}>
						{detail.error}
					</Text>
				</Alert>
			)}
			{!detail.error && detail.waiting_reason && (
				<Alert color="yellow" icon={<LuHourglass size={16} />} p="sm">
					{detail.pending_input ? (
						<Text fz="xs">
							Waiting for input on <strong>{pendingNode?.name ?? detail.pending_input.node_id}</strong>
							<Text span fz="xs" c="dimmed">
								{' · '}
								{detail.pending_input.channel} →{' '}
								{detail.pending_input.output_property || detail.pending_input.node_id}
								{detail.pending_input.form_id && (
									<>
										{' · form '}
										<Text span fz="xs" ff="monospace" title={detail.pending_input.form_id}>
											{detail.pending_input.form_id.slice(0, 8)}
										</Text>
									</>
								)}
								{detail.pending_input.accept?.includes('multipart/form-data') && ' · takes files'}
							</Text>
						</Text>
					) : (
						<Text fz="xs">
							{formatWaitingReason(detail.waiting_reason)}
							{branchInputCount > 0 && (
								<Text span fz="xs" c="dimmed">
									{' · '}
									{branchInputCount} {branchInputCount === 1 ? 'branch' : 'branches'} waiting for
									input
								</Text>
							)}
						</Text>
					)}
				</Alert>
			)}
		</div>
	);
};
