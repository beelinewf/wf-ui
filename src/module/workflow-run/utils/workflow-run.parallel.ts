import type { CoreQueryError } from '@core/api';

import type { WorkflowDefinitionContent } from '@module/workflow-definition/types/WorkflowDefinitionContent';
import type { WorkflowDefinitionNode } from '@module/workflow-definition/types/WorkflowDefinitionNode';
import { analyzeParallel, type ParallelAnalysis, type ParallelMembership } from '@module/workflow-definition/utils';
import type { WorkflowRunDetail } from '@module/workflow-run/types/WorkflowRunDetail';
import type { WorkflowRunNodeStatus } from '@module/workflow-run/types/WorkflowRunNodeStatus';
import type { WorkflowRunParallelBranch } from '@module/workflow-run/types/WorkflowRunParallelBranch';
import type { WorkflowRunParallelExecution } from '@module/workflow-run/types/WorkflowRunParallelExecution';
import type { WorkflowRunPendingInput } from '@module/workflow-run/types/WorkflowRunPendingInput';

import { flattenDefinitionNodes, type WorkflowRunTimeline, type WorkflowRunTimelineEntry } from './workflow-run.detail';

export interface WorkflowRunParallelTreeItem {
	execution: WorkflowRunParallelExecution;
	/** Earlier forks of the same block in the same parent branch (loops, rollbacks), newest first. */
	history: WorkflowRunParallelExecution[];
	depth: number;
}

/**
 * Orders the executions depth-first for display: each block's latest fork, followed by the blocks
 * nested in its branches. The engine lists executions in creation order, so the last fork of a
 * `(parent branch, start node)` pair is the live one; children of superseded forks stay in history.
 */
export const buildParallelTree = (executions: WorkflowRunParallelExecution[]): WorkflowRunParallelTreeItem[] => {
	const byParent = new Map<string, Map<string, WorkflowRunParallelExecution[]>>();
	for (const execution of executions) {
		const parent = execution.parent_branch_id ?? '';
		const blocks = byParent.get(parent) ?? new Map<string, WorkflowRunParallelExecution[]>();
		blocks.set(execution.start_node_id, [...(blocks.get(execution.start_node_id) ?? []), execution]);
		byParent.set(parent, blocks);
	}

	const items: WorkflowRunParallelTreeItem[] = [];
	const visit = (parent: string, depth: number) => {
		for (const forks of byParent.get(parent)?.values() ?? []) {
			const execution = forks[forks.length - 1];
			items.push({ execution, history: forks.slice(0, -1).reverse(), depth });
			for (const branch of sortBranches(execution.branches)) visit(branch.id, depth + 1);
		}
	};
	visit('', 1);
	return items;
};

export const sortBranches = (branches: WorkflowRunParallelBranch[]) =>
	branches.slice().sort((a, b) => a.branch_index - b.branch_index);

/** The newest fork joining at `endNodeId`, which is what the join node on the graph reflects. */
export const latestJoinExecution = (
	executions: WorkflowRunParallelExecution[] | null | undefined,
	endNodeId: string,
): WorkflowRunParallelExecution | null =>
	(executions ?? []).findLast((execution) => execution.end_node_id === endNodeId) ?? null;

interface TimelineGroupStats {
	startedAt: number;
	endedAt: number;
	status: WorkflowRunNodeStatus;
	running: boolean;
	count: number;
	offset: number;
	width: number;
}

export type WorkflowRunTimelineRow = {
	key: string;
	depth: number;
	/** Keys of the enclosing group rows, outermost first; collapsing any of them hides the row. */
	ancestors: string[];
} & (
	| { kind: 'entry'; entry: WorkflowRunTimelineEntry }
	| ({ kind: 'block' | 'branch'; label: string; nodeId: string } & TimelineGroupStats)
);

interface TimelineScope {
	entries: WorkflowRunTimelineEntry[];
	blocks: Map<string, Map<string, TimelineScope>>;
}

/** The status a group shows: the most pressing one among its occurrences. */
const GROUP_STATUS_ORDER: WorkflowRunNodeStatus[] = [
	'failed',
	'running',
	'waiting',
	'rolled_back',
	'cancelled',
	'succeeded',
	'skipped',
	'pending',
];

const MIN_GROUP_WIDTH = 0.012;

const scopeEntries = (scope: TimelineScope): WorkflowRunTimelineEntry[] => [
	...scope.entries,
	...[...scope.blocks.values()].flatMap((branches) => [...branches.values()].flatMap(scopeEntries)),
];

const groupStats = (timeline: WorkflowRunTimeline, entries: WorkflowRunTimelineEntry[]): TimelineGroupStats => {
	const startedAt = Math.min(...entries.map((entry) => entry.startedAt));
	const endedAt = Math.max(...entries.map((entry) => entry.endedAt));
	const statuses = new Set(entries.map((entry) => entry.status));
	const offset = (startedAt - timeline.startedAt) / timeline.spanMs;
	const width = Math.max(MIN_GROUP_WIDTH, (endedAt - startedAt) / timeline.spanMs);
	return {
		startedAt,
		endedAt,
		status: GROUP_STATUS_ORDER.find((status) => statuses.has(status)) ?? 'pending',
		running: entries.some((entry) => entry.running),
		count: entries.length,
		offset: Math.min(offset, 1 - MIN_GROUP_WIDTH),
		width: Math.min(width, 1 - offset),
	};
};

/**
 * Nests timeline entries under the parallel block and branch they ran in, each scope in start order.
 * Occurrences carry no branch id, so membership is structural: nodes several branches can reach stay
 * in the enclosing scope. Without membership (no definition access) the rows stay flat.
 */
export const buildTimelineRows = (
	timeline: WorkflowRunTimeline,
	membership?: Map<string, ParallelMembership>,
	nodesById?: Map<string, WorkflowDefinitionNode>,
): WorkflowRunTimelineRow[] => {
	const root: TimelineScope = { entries: [], blocks: new Map() };
	const resolving = new Set<string>();

	const scopeOf = (nodeId: string): TimelineScope => {
		const owner = membership?.get(nodeId);
		if (!owner || resolving.has(owner.startId)) return root;
		// A block sits in the scope its parallel_start belongs to, which nests blocks inside branches.
		resolving.add(owner.startId);
		const parent = scopeOf(owner.startId);
		resolving.delete(owner.startId);

		const branches = parent.blocks.get(owner.startId) ?? new Map<string, TimelineScope>();
		parent.blocks.set(owner.startId, branches);
		const scope = branches.get(owner.branch) ?? { entries: [], blocks: new Map() };
		branches.set(owner.branch, scope);
		return scope;
	};
	for (const entry of timeline.entries) scopeOf(entry.nodeId).entries.push(entry);

	const rows: WorkflowRunTimelineRow[] = [];
	const flatten = (scope: TimelineScope, depth: number, ancestors: string[]) => {
		const items = [
			...scope.entries.map((entry) => ({ at: entry.startedAt, entry, block: null })),
			...[...scope.blocks].map(([startId, branches]) => {
				const entries = [...branches.values()].flatMap(scopeEntries);
				return {
					at: Math.min(...entries.map((entry) => entry.startedAt)),
					entry: null,
					block: { startId, branches, entries },
				};
			}),
		].sort((a, b) => a.at - b.at);

		for (const item of items) {
			if (item.entry) {
				rows.push({ kind: 'entry', key: item.entry.occurrenceId, depth, ancestors, entry: item.entry });
				continue;
			}
			const { startId, branches, entries } = item.block!;
			const blockKey = `block:${startId}`;
			rows.push({
				kind: 'block',
				key: blockKey,
				depth,
				ancestors,
				label: nodesById?.get(startId)?.name ?? startId,
				nodeId: startId,
				...groupStats(timeline, entries),
			});
			for (const [branch, branchScope] of [...branches].sort(([a], [b]) => a.localeCompare(b))) {
				const branchKey = `${blockKey}:${branch}`;
				rows.push({
					kind: 'branch',
					key: branchKey,
					depth: depth + 1,
					ancestors: [...ancestors, blockKey],
					label: branch,
					nodeId: startId,
					...groupStats(timeline, scopeEntries(branchScope)),
				});
				flatten(branchScope, depth + 2, [...ancestors, blockKey, branchKey]);
			}
		}
	};
	flatten(root, 0, []);
	return rows;
};

export interface WorkflowRunBranchInput {
	executionId: string;
	branch: WorkflowRunParallelBranch;
	node: WorkflowDefinitionNode;
	/** The same contract `pending_input` carries for a run parked on its own input node. */
	pending: WorkflowRunPendingInput;
}

/** An input node the engine reports as in flight: a parked attempt stays `running` to the engine. */
const isLive = (detail: WorkflowRunDetail, nodeId: string) => {
	const status = detail.nodes[nodeId]?.status;
	return status === 'waiting' || status === 'running';
};

/**
 * Branches parked on an http input node that `PUT /input?branch_id=` can deliver to. The engine
 * accepts a branch delivery only while the parent is parked on the join (waiting or paused with
 * waiting reason `parallel`). The parked node is not reported per branch, so it is resolved from
 * the branch's structural walk: a single live input node, else the only input node it can reach.
 */
export const findBranchInputs = (
	detail: WorkflowRunDetail,
	content: WorkflowDefinitionContent,
	analysis: ParallelAnalysis = analyzeParallel(content),
): WorkflowRunBranchInput[] => {
	if (detail.waiting_reason !== 'parallel' || (detail.status !== 'waiting' && detail.status !== 'paused')) return [];

	const byId = new Map(flattenDefinitionNodes(content.nodes).map((node) => [node.id, node]));
	const inputs: WorkflowRunBranchInput[] = [];

	for (const execution of detail.parallel ?? []) {
		for (const branch of sortBranches(execution.branches)) {
			if (branch.status !== 'waiting' || branch.waiting_reason !== 'input') continue;

			const walk = analysis.walks.find(
				(item) => item.startId === execution.start_node_id && item.branch === branch.name,
			);
			const candidates = [...(walk?.visited ?? [])]
				.map((id) => byId.get(id))
				.filter((node): node is WorkflowDefinitionNode => node?.type === 'input');
			const live = candidates.filter((node) => isLive(detail, node.id));
			const node = live.length === 1 ? live[0] : candidates.length === 1 ? candidates[0] : null;
			if (!node || node.channel !== 'http') continue;

			inputs.push({
				executionId: execution.id,
				branch,
				node,
				pending: {
					node_id: node.id,
					channel: node.channel,
					output_property: node.output_property?.trim() || node.id,
					form_id: node.form_id,
					accept: node.accept,
				},
			});
		}
	}
	return inputs;
};

/** Delivery errors worth explaining; anything else falls back to the engine's message. */
export const describeInputError = (error: unknown, branch: boolean): string => {
	const { code, message, explain } = (error && typeof error === 'object' ? error : {}) as Partial<CoreQueryError>;
	const detail = message || explain;

	if (branch && code === 404)
		return 'This branch no longer exists. The run may have re-forked or moved past the join.';
	if (branch && code === 409) {
		return `The run isn't parked on the parallel join any more, or this branch isn't waiting on an HTTP input.${detail ? ` (${detail})` : ''}`;
	}
	if (code === 413) {
		return `The upload is over a size or count limit (per file, in total, or the number of files).${detail ? ` (${detail})` : ''}`;
	}
	if (code === 415) return `This input doesn't take this kind of body.${detail ? ` (${detail})` : ''}`;
	return detail || 'Failed to deliver input';
};
