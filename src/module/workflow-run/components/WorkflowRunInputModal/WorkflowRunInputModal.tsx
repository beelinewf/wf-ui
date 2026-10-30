import React, { useState } from 'react';

import { Alert, Anchor, Badge, Button, Center, Group, Loader, Modal, Select, Stack, Text } from '@mantine/core';
import { LuCircleAlert, LuInfo, LuLock } from 'react-icons/lu';
import { Link } from 'react-router';

import { useResolvedForm } from '@module/form-engine/hooks';
import type { FormResolveState } from '@module/form-engine/types/FormResolveState';
import { formLibraryPath } from '@module/form-engine/utils';
import { useGetWorkflowRunContextQuery } from '@module/workflow-run/hooks';
import type { WorkflowRunPendingInput } from '@module/workflow-run/types/WorkflowRunPendingInput';
import type { WorkflowRunBranchInput } from '@module/workflow-run/utils';

import { WorkflowRunInputFormBody } from './WorkflowRunInputFormBody';
import { WorkflowRunInputRawBody } from './WorkflowRunInputRawBody';

interface WorkflowRunInputModalProps {
	opened: boolean;
	/** The run, whose context feeds `{{ context.* }}` in the form's remote selects. */
	runId: string;
	/** The run's own parked input; takes precedence over branches. */
	pending: WorkflowRunPendingInput | null;
	/** Parallel branches parked on an http input while the run waits on their join. */
	branches?: WorkflowRunBranchInput[];
	/** Preselects a branch; defaults to the first parked one. */
	branchId?: string | null;
	onClose: () => void;
	/** Resolves once the engine accepted the payload; a rejection keeps the modal open. FormData goes out as multipart. */
	onSubmit: (payload: unknown | FormData, branchId?: string) => Promise<void>;
}

/** Which form the input renders, or why it falls back to raw JSON. */
const FormSourceNote: React.FC<{ resolved: FormResolveState }> = ({ resolved }) => {
	switch (resolved.status) {
		case 'ready':
			return (
				<Group gap={6}>
					<Text fz="xs" c="dimmed">
						Form
					</Text>
					{resolved.form ? (
						<Anchor component={Link} to={formLibraryPath(resolved.form.id)} fz="xs" fw={600}>
							{resolved.form.name}
						</Anchor>
					) : null}
					{resolved.frozen && (
						<Badge size="xs" variant="light" color="gray" leftSection={<LuLock size={10} />}>
							frozen at start
						</Badge>
					)}
				</Group>
			);
		case 'forbidden':
			return (
				<Alert color="gray" variant="light" icon={<LuInfo size={16} />} p="sm">
					<Text fz="xs">
						This input has a form, but your role can't load forms (needs <code>forms:read</code>). Send the
						JSON payload directly.
					</Text>
				</Alert>
			);
		case 'error':
			return (
				<Alert color="red" variant="light" icon={<LuCircleAlert size={16} />} p="sm">
					<Group justify="space-between" gap="xs" wrap="nowrap">
						<Text fz="xs">{resolved.message} Send the JSON payload directly instead.</Text>
						<Button size="compact-xs" variant="default" onClick={resolved.retry}>
							Retry
						</Button>
					</Group>
				</Alert>
			);
		default:
			return null;
	}
};

export const WorkflowRunInputModal: React.FC<WorkflowRunInputModalProps> = ({
	opened,
	runId,
	pending,
	branches = [],
	branchId,
	onClose,
	onSubmit,
}) => {
	const [picked, setPicked] = useState<string | null>(null);

	// The run's own input wins; otherwise the requested branch, and only while it is still parked.
	const requested = picked ?? branchId ?? null;
	const branch = pending
		? null
		: requested
			? (branches.find((item) => item.branch.id === requested) ?? null)
			: (branches[0] ?? null);
	const target = pending ?? branch?.pending ?? null;
	const resolved = useResolvedForm(opened ? target : null);
	const { data: context } = useGetWorkflowRunContextQuery(runId, {
		skip: !opened || resolved.status !== 'ready',
		refetchOnMountOrArgChange: true,
	});

	const close = () => {
		setPicked(null);
		onClose();
	};

	const deliver = async (payload: unknown | FormData) => {
		await onSubmit(payload, branch?.branch.id);
		close();
	};

	// A new target or form starts a fresh body, so nothing typed for one input leaks into another.
	const bodyKey = `${branch?.branch.id ?? 'run'}:${target?.node_id}:${resolved.status}`;

	const renderBody = () => {
		if (resolved.status === 'loading') {
			return (
				<Center py="lg">
					<Loader size="sm" />
				</Center>
			);
		}
		if (resolved.status === 'ready') {
			return (
				<WorkflowRunInputFormBody
					key={bodyKey}
					schema={resolved.schema}
					ui={resolved.ui}
					context={context}
					accept={target?.accept}
					onCancel={close}
					onSubmit={deliver}
				/>
			);
		}
		return <WorkflowRunInputRawBody key={bodyKey} accept={target?.accept} onCancel={close} onSubmit={deliver} />;
	};

	return (
		<Modal
			opened={opened}
			onClose={close}
			title="Provide workflow input"
			centered
			size={resolved.status === 'ready' ? 'xl' : 'md'}
		>
			{target && (
				<Stack gap="md">
					{branches.length > 1 && !pending && (
						<Select
							label="Branch"
							description="Parallel branches parked on an input node"
							data={branches.map((item) => ({
								value: item.branch.id,
								label: `${item.branch.name} · ${item.node.name}`,
							}))}
							value={branch?.branch.id ?? null}
							allowDeselect={false}
							onChange={setPicked}
						/>
					)}

					<Alert color="blue" icon={<LuInfo size={16} />} p="sm">
						{branch ? (
							<Text fz="xs">
								Branch <strong>{branch.branch.name}</strong> is parked on{' '}
								<strong>{branch.node.name}</strong>. The payload is written to context key{' '}
								<strong>{target.output_property}</strong> of that branch; the join decides what reaches
								the run.
							</Text>
						) : (
							<Text fz="xs">
								The run is parked on <strong>{target.node_id}</strong>. The payload is written to
								context key <strong>{target.output_property || target.node_id}</strong>.
							</Text>
						)}
						<Group gap={4} mt={6}>
							<Badge size="xs" variant="light">
								channel {target.channel}
							</Badge>
							{target.accept?.includes('multipart/form-data') && (
								<Badge size="xs" variant="light" color="grape">
									multipart
								</Badge>
							)}
						</Group>
					</Alert>

					<FormSourceNote resolved={resolved} />

					{renderBody()}
				</Stack>
			)}
			{!target && (
				<Stack gap="md">
					<Text fz="sm">
						Nothing is waiting for input any more. The run may have moved on since you opened this.
					</Text>
					<Group justify="flex-end">
						<Button variant="default" onClick={close}>
							Close
						</Button>
					</Group>
				</Stack>
			)}
		</Modal>
	);
};
