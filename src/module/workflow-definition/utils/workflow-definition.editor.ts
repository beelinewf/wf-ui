import { humanizeKey, isRecord, seedObject } from '@module/form-engine/components/SchemaForm';
import type { NodeDefinition } from '@module/node-definition/types/NodeDefinition';
import { EMPTY_NODE_TYPE_CATALOG } from '@module/node-type/constant';
import type { NodeTypeCatalog } from '@module/node-type/types/NodeTypeCatalog';
import { nodeTypeHasField, nodeTypeMetaOf, nodeTypeValidation } from '@module/node-type/utils';
import { MAX_PARALLEL_BRANCHES, MAX_PARALLEL_DEPTH, MIN_PARALLEL_BRANCHES } from '@module/workflow-definition/constant';
import {
	DEFAULT_COMBINING,
	EDITOR_METADATA_KEY,
	GRAPH_FIELDS,
	HANDLE_FAILURE,
	HANDLE_NEXT,
	ROOT_SCOPE,
} from '@module/workflow-definition/constant';
import type { WorkflowDefinition } from '@module/workflow-definition/types/WorkflowDefinition';
import type { WorkflowDefinitionContent } from '@module/workflow-definition/types/WorkflowDefinitionContent';
import type { WorkflowDefinitionEditorBranch } from '@module/workflow-definition/types/WorkflowDefinitionEditorBranch';
import type { WorkflowDefinitionEditorDocument } from '@module/workflow-definition/types/WorkflowDefinitionEditorDocument';
import type { WorkflowDefinitionEditorEdge } from '@module/workflow-definition/types/WorkflowDefinitionEditorEdge';
import type { WorkflowDefinitionEditorIssue } from '@module/workflow-definition/types/WorkflowDefinitionEditorIssue';
import type { WorkflowDefinitionEditorNode } from '@module/workflow-definition/types/WorkflowDefinitionEditorNode';
import type { WorkflowDefinitionEditorPosition } from '@module/workflow-definition/types/WorkflowDefinitionEditorPosition';
import type { WorkflowDefinitionJsonField } from '@module/workflow-definition/types/WorkflowDefinitionJsonField';
import type { WorkflowDefinitionNode } from '@module/workflow-definition/types/WorkflowDefinitionNode';
import type { WorkflowDefinitionNodeConfig } from '@module/workflow-definition/types/WorkflowDefinitionNodeConfig';
import type { WorkflowDefinitionNodeType } from '@module/workflow-definition/types/WorkflowDefinitionNodeType';

import { layoutGraph } from './workflow-definition.meta';
import { analyzeParallel, type ParallelProblem } from './workflow-definition.parallel';

const START_PREFIX = 'start:';
const COLUMN_WIDTH = 300;
const ROW_HEIGHT = 140;

export const scopeKey = (scope: string | null) => scope ?? ROOT_SCOPE;
export const startNodeId = (scope: string | null) => `${START_PREFIX}${scopeKey(scope)}`;
export const isStartNodeId = (id: string) => id.startsWith(START_PREFIX);
export const scopeOfStartNode = (id: string) => {
	const key = id.slice(START_PREFIX.length);
	return key === ROOT_SCOPE ? null : key;
};
export const branchHandle = (branchId: string) => `branch:${branchId}`;
export const pairEdgeId = (startId: string) => `pair:${startId}`;
export const isPairEdgeId = (id: string) => id.startsWith('pair:');

export const uuidv7 = () => {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	const timestamp = BigInt(Date.now());
	for (let index = 0; index < 6; index++) bytes[index] = Number((timestamp >> BigInt(8 * (5 - index))) & 0xffn);
	bytes[6] = (bytes[6] & 0x0f) | 0x70;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const shortId = () => Math.random().toString(36).slice(2, 10);

/** What the catalog says a type accepts decides its handles and fields. */
export const supportsNext = (type: WorkflowDefinitionNodeType, catalog: NodeTypeCatalog) =>
	nodeTypeHasField(catalog, type, 'next_node');
export const supportsFailure = (type: WorkflowDefinitionNodeType, catalog: NodeTypeCatalog) =>
	nodeTypeHasField(catalog, type, 'on_failure');
export const supportsOutputProperty = (type: WorkflowDefinitionNodeType, catalog: NodeTypeCatalog) =>
	nodeTypeHasField(catalog, type, 'output_property');
export const isParallelType = (type: WorkflowDefinitionNodeType) =>
	type === 'parallel_start' || type === 'parallel_end';
export const toSnakeCase = (value: string) =>
	value
		.replace(/([a-z\d])([A-Z])/g, '$1_$2')
		.toLowerCase()
		.split(/[^a-z\d]+/)
		.filter(Boolean)
		.join('_');
export const defaultOutputProperty = (config: WorkflowDefinitionNodeConfig, catalog: NodeTypeCatalog) =>
	supportsOutputProperty(config.type, catalog) ? toSnakeCase(config.name) || undefined : undefined;
/**
 * The engine rejects `start_delay` on these: input already waits, and a delay node is the wait itself. Kept here
 * because the served schemas don't list `start_delay` at all, though the parser accepts it on every other type.
 */
export const supportsStartDelay = (type: WorkflowDefinitionNodeType) => type !== 'input' && type !== 'delay';

/** Types whose routing goes out through one handle per editor branch instead of `next`. */
export const hasBranches = (type: WorkflowDefinitionNodeType) => type === 'conditions' || type === 'parallel_start';

export const isInlineGroup = (node: WorkflowDefinitionEditorNode) =>
	node.config.type === 'group' && !node.config.node_definition_id;

/**
 * A library parallel_start is opaque unless the workflow node carries its own `branches`: library definitions hold
 * hard-coded graph ids, so only inline branches can be drawn and routed.
 */
const routesParallelBranches = (node: WorkflowDefinitionEditorNode) =>
	node.config.type === 'parallel_start' && (!node.config.node_definition_id || node.branches.length > 0);

// Name and metadata are the editor's own; graph fields come from the canvas.
const UNSEEDED_FIELDS: ReadonlySet<string> = new Set([...GRAPH_FIELDS, 'name', 'metadata', 'node_definition_id']);

/**
 * A new node's starting config, read off its catalog schema: defaults, plus every required field filled with its
 * first allowed value or an empty one, so validation points at what's left to fill in.
 */
const seedNodeConfig = (catalog: NodeTypeCatalog, type: WorkflowDefinitionNodeType) => {
	const item = catalog.byType[type];
	// A custom type registered without a schema still needs the `config` object every custom node carries.
	if (!item?.schema) return item && !item.builtin ? { config: {} } : {};
	const config = seedObject(item.schema, item.schema, UNSEEDED_FIELDS);
	// The join's script starts as a commented example of how combining works rather than blank.
	if (type === 'parallel_end' && !config.combining_script) config.combining_script = DEFAULT_COMBINING;
	return config;
};

const scopeNodes = (nodes: Record<string, WorkflowDefinitionEditorNode>, scope: string | null) =>
	Object.values(nodes).filter((node) => node.parentId === scope);

const freeBranchKeys = (used: Set<string>, count: number) => {
	const keys: string[] = [];
	for (let index = 1; keys.length < count; index++) {
		if (!used.has(`branch_${index}`)) keys.push(`branch_${index}`);
	}
	return keys;
};

/** Condition keys share the scope's `keys` map, so they are unique across every conditions node in the scope. */
export const nextBranchKeys = (
	nodes: Record<string, WorkflowDefinitionEditorNode>,
	scope: string | null,
	count: number,
	reserved: string[] = [],
) =>
	freeBranchKeys(
		new Set([
			...scopeNodes(nodes, scope)
				.filter((node) => node.config.type === 'conditions')
				.flatMap((node) => node.branches.map((branch) => branch.key)),
			...reserved,
		]),
		count,
	);

/** Parallel branch names are local to their parallel_start. */
export const nextParallelBranchNames = (branches: WorkflowDefinitionEditorBranch[], count: number) =>
	freeBranchKeys(new Set(branches.map((branch) => branch.key)), count);

const nextNodeName = (nodes: Record<string, WorkflowDefinitionEditorNode>, scope: string | null, base: string) => {
	const used = new Set(scopeNodes(nodes, scope).map((node) => node.config.name));
	if (!used.has(base)) return base;
	let index = 2;
	while (used.has(`${base} ${index}`)) index++;
	return `${base} ${index}`;
};

export const createEditorNode = (
	nodes: Record<string, WorkflowDefinitionEditorNode>,
	scope: string | null,
	position: WorkflowDefinitionEditorPosition,
	source: { type: WorkflowDefinitionNodeType } | { definition: NodeDefinition },
	catalog: NodeTypeCatalog,
): WorkflowDefinitionEditorNode => {
	const id = uuidv7();

	if ('definition' in source) {
		const { definition } = source;
		return {
			id,
			parentId: scope,
			position,
			config: {
				type: definition.type,
				name: nextNodeName(nodes, scope, definition.name),
				node_definition_id: definition.id,
			},
			branches: referenceBranches(definition),
			failureOutputProperty: '',
			jsonDrafts: {},
			reference: { name: definition.name, version: definition.version },
		};
	}

	const keys =
		source.type === 'conditions'
			? nextBranchKeys(nodes, scope, 2)
			: source.type === 'parallel_start'
				? nextParallelBranchNames([], 2)
				: [];
	const branches = keys.map((key) => ({ id: shortId(), key, condition: '' }));

	return {
		id,
		parentId: scope,
		position,
		config: {
			type: source.type,
			name: nextNodeName(nodes, scope, nodeTypeMetaOf(source.type).label),
			...seedNodeConfig(catalog, source.type),
		},
		branches,
		failureOutputProperty: '',
		jsonDrafts: {},
	};
};

/** A parallel_start with two branches and its join one step further right, linked both ways. */
export const createParallelPair = (
	nodes: Record<string, WorkflowDefinitionEditorNode>,
	scope: string | null,
	position: WorkflowDefinitionEditorPosition,
	catalog: NodeTypeCatalog,
): [WorkflowDefinitionEditorNode, WorkflowDefinitionEditorNode] => {
	const start = createEditorNode(nodes, scope, position, { type: 'parallel_start' }, catalog);
	const end = createEditorNode(
		nodes,
		scope,
		{ x: position.x + 2 * COLUMN_WIDTH, y: position.y },
		{ type: 'parallel_end' },
		catalog,
	);
	start.pairId = end.id;
	end.pairId = start.id;
	return [start, end];
};

// Library parallel_starts stay opaque (see routesParallelBranches), so only conditions carry branches over.
const referenceBranches = (definition: NodeDefinition) =>
	(definition.content.conditions ?? []).map((condition) => ({
		id: shortId(),
		key: condition.key ?? '',
		condition: condition.condition,
	}));

export const readJsonField = (config: WorkflowDefinitionNodeConfig, field: WorkflowDefinitionJsonField): unknown => {
	if (field === 'metadata') {
		if (!config.metadata) return undefined;
		const { [EDITOR_METADATA_KEY]: _editor, ...rest } = config.metadata;
		return Object.keys(rest).length > 0 ? rest : undefined;
	}
	return field
		.split('.')
		.reduce<unknown>((value, key) => (isRecord(value) ? value[key] : undefined), config as Record<string, unknown>);
};

export const formatJson = (value: unknown) => (value === undefined ? '' : JSON.stringify(value, null, 2));

export const parseJsonDraft = (text: string): { ok: true; value: unknown } | { ok: false } => {
	if (text.trim() === '') return { ok: true, value: undefined };
	try {
		return { ok: true, value: JSON.parse(text) };
	} catch {
		return { ok: false };
	}
};

/** Writes a parsed draft into a cloned config. A nested field only lands while its parent object exists. */
const writeJsonField = (config: WorkflowDefinitionNodeConfig, field: WorkflowDefinitionJsonField, value: unknown) => {
	const keys = field.split('.');
	const last = keys.pop()!;
	let parent: unknown = config;
	for (const key of keys) parent = isRecord(parent) ? parent[key] : undefined;
	if (!isRecord(parent)) return;
	if (value === undefined) delete parent[last];
	else parent[last] = value;
};

const resolveNodeConfig = (node: WorkflowDefinitionEditorNode) => {
	const config = structuredClone(node.config);
	for (const [field, text] of Object.entries(node.jsonDrafts)) {
		const parsed = parseJsonDraft(text);
		if (parsed.ok) writeJsonField(config, field as WorkflowDefinitionJsonField, parsed.value);
	}
	return config;
};

const RAW_ROUTING_FIELDS = ['id', 'next_node', 'on_failure', 'nodes', 'start_node_id', 'parallel_end_node_id'] as const;

const hasRawConditions = (node: WorkflowDefinitionEditorNode) =>
	node.config.type === 'conditions' && !node.config.node_definition_id;

const hasRawParallelBranches = (node: WorkflowDefinitionEditorNode) =>
	node.config.type === 'parallel_start' && !node.config.node_definition_id;

const rawParallelBranches = (node: WorkflowDefinitionEditorNode, edges: WorkflowDefinitionEditorEdge[]) =>
	Object.fromEntries(
		node.branches.map((branch) => [branch.key, outgoingTarget(edges, node.id, branchHandle(branch.id))]),
	);

export const formatRawNode = (node: WorkflowDefinitionEditorNode, edges: WorkflowDefinitionEditorEdge[]) => {
	const config = resolveNodeConfig(node);
	const metadata = readJsonField(config, 'metadata') as Record<string, unknown> | undefined;
	if (metadata) config.metadata = metadata;
	else delete config.metadata;

	const raw: Record<string, unknown> = { ...config };
	if (hasRawConditions(node)) {
		raw.conditions = node.branches.map((branch) =>
			branch.key ? { key: branch.key, condition: branch.condition } : { condition: branch.condition },
		);
	}
	if (hasRawParallelBranches(node)) raw.branches = rawParallelBranches(node, edges);
	return JSON.stringify(raw, null, 2);
};

type RawNodeResult =
	| { ok: true; config: WorkflowDefinitionNodeConfig; branches?: WorkflowDefinitionEditorNode['branches'] }
	| { ok: false; error: string };

const parseRawParallelBranches = (
	node: WorkflowDefinitionEditorNode,
	edges: WorkflowDefinitionEditorEdge[],
	branches: unknown,
	config: WorkflowDefinitionNodeConfig,
): RawNodeResult => {
	if (
		!isRecord(branches) ||
		!Object.values(branches).every((target) => target === null || typeof target === 'string')
	) {
		return { ok: false, error: 'branches must be an object of { name: target }' };
	}
	// Untouched branches stay as they are, so duplicate names (which JSON can't hold twice) survive other edits.
	if (JSON.stringify(branches) === JSON.stringify(rawParallelBranches(node, edges))) return { ok: true, config };

	// Branches are matched by position, like conditions; only their names can change here.
	const entries = Object.entries(branches as Record<string, string | null>);
	const moved = entries.some(([, target], index) => {
		const current = node.branches[index];
		return (target || null) !== (current ? outgoingTarget(edges, node.id, branchHandle(current.id)) : null);
	});
	if (moved) return { ok: false, error: 'Branch targets are set on the canvas; only names can change here' };

	return {
		ok: true,
		config,
		branches: entries.map(([key], index) => ({ id: node.branches[index]?.id ?? shortId(), key, condition: '' })),
	};
};

export const parseRawNode = (
	node: WorkflowDefinitionEditorNode,
	edges: WorkflowDefinitionEditorEdge[],
	text: string,
): RawNodeResult => {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return { ok: false, error: 'Not valid JSON' };
	}
	if (!isRecord(raw)) return { ok: false, error: 'Node must be a JSON object' };

	const routing = RAW_ROUTING_FIELDS.filter((field) => field in raw);
	if (routing.length > 0) return { ok: false, error: `${routing.join(', ')} are set on the canvas, not here` };
	if (raw.type !== node.config.type) return { ok: false, error: `type must stay "${node.config.type}"` };
	if (raw.node_definition_id !== node.config.node_definition_id) {
		return { ok: false, error: 'node_definition_id cannot be changed' };
	}
	if (typeof raw.name !== 'string') return { ok: false, error: 'name must be a string' };
	if (raw.metadata !== undefined && !isRecord(raw.metadata)) {
		return { ok: false, error: 'metadata must be a JSON object' };
	}

	const { conditions, branches: forks, ...config } = raw;
	if (hasRawParallelBranches(node)) {
		if (conditions !== undefined) return { ok: false, error: 'conditions only apply to inline conditions nodes' };
		return parseRawParallelBranches(node, edges, forks, config as unknown as WorkflowDefinitionNodeConfig);
	}
	if (forks !== undefined) return { ok: false, error: 'branches only apply to inline parallel_start nodes' };
	if (!hasRawConditions(node)) {
		if (conditions !== undefined) return { ok: false, error: 'conditions only apply to inline conditions nodes' };
		return { ok: true, config: config as unknown as WorkflowDefinitionNodeConfig };
	}

	if (
		!Array.isArray(conditions) ||
		!conditions.every(
			(item) =>
				isRecord(item) &&
				typeof item.condition === 'string' &&
				(item.key === undefined || typeof item.key === 'string'),
		)
	) {
		return { ok: false, error: 'conditions must be a list of { key, condition }' };
	}

	// Branches are matched by position so existing canvas connections survive edits.
	const branches = (conditions as { key?: string; condition: string }[]).map((item, index) => ({
		id: node.branches[index]?.id ?? shortId(),
		key: item.key ?? '',
		condition: item.condition,
	}));
	return { ok: true, config: config as unknown as WorkflowDefinitionNodeConfig, branches };
};

const readPosition = (node: WorkflowDefinitionNode): WorkflowDefinitionEditorPosition | null => {
	const editor = node.metadata?.[EDITOR_METADATA_KEY] as { position?: WorkflowDefinitionEditorPosition } | undefined;
	const position = editor?.position;
	return position && Number.isFinite(position.x) && Number.isFinite(position.y) ? position : null;
};

export const toEditorDocument = (
	definition: WorkflowDefinition | null,
	references: Record<string, NodeDefinition>,
): WorkflowDefinitionEditorDocument => {
	const document: WorkflowDefinitionEditorDocument = {
		sourceId: definition?.id ?? null,
		sourceVersion: definition?.version ?? null,
		name: definition?.name ?? '',
		contextMode: definition?.content.context_mode ?? null,
		statusUpdate: definition?.content.status_update ?? null,
		nodes: {},
		starts: { [ROOT_SCOPE]: { position: { x: 0, y: 0 } } },
		edges: [],
		nodeDefinition: null,
	};
	if (!definition) return document;

	const addEdge = (source: string, sourceHandle: string, target: string | null | undefined) => {
		if (target) document.edges.push({ id: `${source}:${sourceHandle}`, source, sourceHandle, target });
	};
	const pairs: [start: string, end: string][] = [];

	const readScope = (
		scope: string | null,
		startId: string | undefined,
		nodes: WorkflowDefinitionNode[],
		keys: Record<string, string | null> | undefined,
	) => {
		const layout = layoutGraph({ start_node_id: startId ?? '', nodes, keys });
		const columnRows = new Map<number, number>();
		for (const node of layout.nodes) columnRows.set(node.column, (columnRows.get(node.column) ?? 0) + 1);
		const autoPositions = new Map(
			layout.nodes.map((node) => {
				const offset = (layout.rows - (columnRows.get(node.column) ?? 1)) / 2;
				return [node.id, { x: (node.column + 1) * COLUMN_WIDTH, y: (node.row + offset) * ROW_HEIGHT }];
			}),
		);
		let orphanColumn = 0;

		for (const node of nodes) {
			const {
				id,
				next_node,
				on_failure,
				conditions,
				nodes: children,
				start_node_id,
				keys: childKeys,
				branches: forkTargets,
				parallel_end_node_id,
				...config
			} = node;
			const reference = config.node_definition_id ? references[config.node_definition_id] : undefined;
			// References may omit `type`; it is implied by the referenced node definition.
			if (!config.type && reference) config.type = reference.type;
			if (config.type === 'input' && config.context_path !== undefined) {
				// Input nodes used to write the payload at context_path; the engine now takes a bare output_property.
				config.output_property ??= config.context_path.match(OUTPUT_KEY_PREFIX)?.[0];
				delete config.context_path;
			}
			const inlineGroup = config.type === 'group' && !config.node_definition_id;

			if (!inlineGroup && childKeys) (config as WorkflowDefinitionNodeConfig).keys = childKeys;

			const position = readPosition(node) ??
				autoPositions.get(id) ?? {
					x: (orphanColumn++ + 1) * COLUMN_WIDTH,
					y: (layout.rows + 1) * ROW_HEIGHT,
				};

			// Sorted by name like the engine's branch index. Only inline branches count (see routesParallelBranches).
			const forks =
				config.type === 'parallel_start'
					? Object.entries(forkTargets ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
					: [];
			const branches =
				config.type === 'parallel_start'
					? forks.map(([name]) => ({ id: shortId(), key: name, condition: '' }))
					: (conditions ?? (reference ? reference.content.conditions : undefined) ?? []).map((condition) => ({
							id: shortId(),
							key: condition.key ?? '',
							condition: condition.condition,
						}));

			document.nodes[id] = {
				id,
				parentId: scope,
				position,
				config,
				branches,
				failureOutputProperty: on_failure?.output_property ?? '',
				jsonDrafts: {},
				reference: reference ? { name: reference.name, version: reference.version } : undefined,
			};

			addEdge(id, HANDLE_NEXT, next_node);
			addEdge(id, HANDLE_FAILURE, on_failure?.next_node);
			if (config.type === 'parallel_start') {
				forks.forEach(([, target], index) => addEdge(id, branchHandle(branches[index].id), target));
				if (parallel_end_node_id) pairs.push([id, parallel_end_node_id]);
			} else {
				for (const branch of branches) {
					if (branch.key) addEdge(id, branchHandle(branch.id), keys?.[branch.key]);
				}
			}

			if (inlineGroup) readScope(id, start_node_id, children ?? [], childKeys);
		}

		const startNode = startId ? document.nodes[startId] : undefined;
		const startPosition = startNode
			? { x: startNode.position.x - COLUMN_WIDTH + 80, y: startNode.position.y + 12 }
			: { x: 0, y: 0 };
		document.starts[scopeKey(scope)] = { position: startPosition };
		addEdge(startNodeId(scope), HANDLE_NEXT, startId);
	};

	readScope(null, definition.content.start_node_id, definition.content.nodes, definition.content.keys);

	// Linked once every scope is read: a join may come before its start. A dangling or shared join is left for
	// validation to point out; the start keeps its id either way so nothing is lost on save.
	for (const [start, end] of pairs) {
		document.nodes[start].pairId = end;
		const join = document.nodes[end];
		if (join?.config.type === 'parallel_end') join.pairId = start;
	}
	return document;
};

export const outgoingTarget = (edges: WorkflowDefinitionEditorEdge[], source: string, sourceHandle: string) =>
	edges.find((edge) => edge.source === source && edge.sourceHandle === sourceHandle)?.target ?? null;

/** Gap kept between stacked nodes when a node is taller than a plain row. */
const ROW_GAP = 40;

/**
 * Lays a scope out left to right from its start node: each node sits one column past its furthest
 * predecessor, and rows follow the order handles are drawn (next, branches, failure) so branches
 * don't cross. Nodes Start can't reach go in a row below. Returns the start position too.
 */
export const layoutScope = (
	document: Pick<WorkflowDefinitionEditorDocument, 'nodes' | 'edges'>,
	scope: string | null,
): { start: WorkflowDefinitionEditorPosition; nodes: Record<string, WorkflowDefinitionEditorPosition> } => {
	const members = scopeNodes(document.nodes, scope);
	const memberIds = new Set(members.map((node) => node.id));
	const handleOrder = (node: WorkflowDefinitionEditorNode | undefined, handle: string) => {
		if (handle === HANDLE_NEXT) return 0;
		if (handle === HANDLE_FAILURE) return Number.MAX_SAFE_INTEGER;
		return 1 + (node?.branches.findIndex((branch) => branchHandle(branch.id) === handle) ?? 0);
	};
	const targetsOf = (id: string) =>
		document.edges
			.filter((edge) => edge.source === id && memberIds.has(edge.target))
			.sort(
				(a, b) =>
					handleOrder(document.nodes[id], a.sourceHandle) - handleOrder(document.nodes[id], b.sourceHandle),
			)
			.map((edge) => edge.target);

	// Longest path from Start, ignoring back edges so loops don't push nodes off forever.
	const depth = new Map<string, number>();
	const visit = (id: string, level: number, trail: Set<string>) => {
		if (trail.has(id) || (depth.get(id) ?? -1) >= level) return;
		depth.set(id, level);
		const nextTrail = new Set(trail).add(id);
		for (const target of targetsOf(id)) visit(target, level + 1, nextTrail);
	};
	const first = outgoingTarget(document.edges, startNodeId(scope), HANDLE_NEXT);
	if (first && memberIds.has(first)) visit(first, 0, new Set());

	// Depth-first discovery order decides who goes above whom within a column.
	const order = new Map<string, number>();
	const discover = (id: string) => {
		if (order.has(id) || !depth.has(id)) return;
		order.set(id, order.size);
		for (const target of targetsOf(id)) discover(target);
	};
	if (first) discover(first);

	const columns: string[][] = [];
	for (const id of [...order.keys()]) (columns[depth.get(id)!] ??= []).push(id);
	const rowHeight = Math.max(ROW_HEIGHT, ...members.map((node) => (node.measured?.height ?? 0) + ROW_GAP));
	const rows = Math.max(1, ...columns.map((column) => column?.length ?? 0));

	const positions: Record<string, WorkflowDefinitionEditorPosition> = {};
	columns.forEach((column, index) => {
		const offset = (rows - column.length) / 2;
		column.forEach((id, row) => {
			positions[id] = { x: (index + 1) * COLUMN_WIDTH, y: (row + offset) * rowHeight };
		});
	});
	let orphanColumn = 0;
	for (const node of members) {
		if (positions[node.id]) continue;
		positions[node.id] = { x: (orphanColumn++ + 1) * COLUMN_WIDTH, y: (rows + 1) * rowHeight };
	}

	const firstPosition = first ? positions[first] : undefined;
	const start = firstPosition ? { x: firstPosition.x - COLUMN_WIDTH + 80, y: firstPosition.y + 12 } : { x: 0, y: 0 };
	return { start, nodes: positions };
};

/**
 * The content to save. The catalog decides which nodes get a default output property; without it, none do.
 */
export const toWorkflowDefinitionContent = (
	document: WorkflowDefinitionEditorDocument,
	catalog: NodeTypeCatalog = EMPTY_NODE_TYPE_CATALOG,
): WorkflowDefinitionContent => {
	const writeScope = (scope: string | null) => {
		const keys: Record<string, string | null> = {};

		const nodes = scopeNodes(document.nodes, scope).map((editorNode) => {
			const config = resolveNodeConfig(editorNode);
			config.metadata = {
				...config.metadata,
				[EDITOR_METADATA_KEY]: {
					position: { x: Math.round(editorNode.position.x), y: Math.round(editorNode.position.y) },
				},
			};

			config.output_property ||= defaultOutputProperty(config, catalog);
			// Null only means "disable the library delay" on a reference; inline it is the same as omitting it.
			if (config.start_delay === null && !config.node_definition_id) delete config.start_delay;

			const node: WorkflowDefinitionNode = { id: editorNode.id, ...config };
			const { type } = config;

			// A handle is only drawn where the type has the field, so an edge on it means the field is accepted.
			const next = outgoingTarget(document.edges, editorNode.id, HANDLE_NEXT);
			if (next) node.next_node = next;

			const failure = outgoingTarget(document.edges, editorNode.id, HANDLE_FAILURE);
			if (failure) {
				node.on_failure = { next_node: failure, output_property: editorNode.failureOutputProperty.trim() };
			}

			if (type === 'conditions') {
				const conditions = editorNode.branches.map((branch) => {
					const key = branch.key.trim();
					if (key) keys[key] = outgoingTarget(document.edges, editorNode.id, branchHandle(branch.id));
					return key ? { key, condition: branch.condition } : { condition: branch.condition };
				});
				if (!config.node_definition_id) node.conditions = conditions;
			}

			// Parallel branch names are local to the node, so they stay out of the scope's `keys`.
			if (type === 'parallel_start') {
				if (routesParallelBranches(editorNode)) {
					node.branches = Object.fromEntries(
						editorNode.branches.map((branch) => [
							branch.key.trim(),
							outgoingTarget(document.edges, editorNode.id, branchHandle(branch.id)) ?? '',
						]),
					);
				}
				if (editorNode.pairId) node.parallel_end_node_id = editorNode.pairId;
			}

			if (isInlineGroup(editorNode)) {
				const inner = writeScope(editorNode.id);
				node.start_node_id = inner.start_node_id;
				node.nodes = inner.nodes;
				if (inner.keys) node.keys = inner.keys;
			}

			return node;
		});

		return {
			start_node_id: outgoingTarget(document.edges, startNodeId(scope), HANDLE_NEXT) ?? '',
			nodes,
			keys: Object.keys(keys).length > 0 ? keys : undefined,
		};
	};

	const root = writeScope(null);
	const content: WorkflowDefinitionContent = { start_node_id: root.start_node_id, nodes: root.nodes };
	if (root.keys) content.keys = root.keys;
	if (document.contextMode) content.context_mode = document.contextMode;
	if (document.statusUpdate) content.status_update = document.statusUpdate;
	return content;
};

const CONTEXT_PATH = /^[A-Za-z_]\w*(\[\d+\])*(\.[A-Za-z_]\w*(\[\d+\])*)*$/;
const OUTPUT_KEY = /^\w+$/;
const OUTPUT_KEY_PREFIX = /^\w+/;
const DURATION = /^(\d+(\.\d+)?(ns|us|µs|ms|s|m|h))+$/;

export const isContextPath = (value: string) => CONTEXT_PATH.test(value);
export const isOutputKey = (value: string) => OUTPUT_KEY.test(value);
export const isDuration = (value: string) => DURATION.test(value) && !/^(0+(\.0+)?[a-zµ]+)+$/.test(value);

const flattenContentNodes = (nodes: WorkflowDefinitionNode[]): WorkflowDefinitionNode[] =>
	nodes.flatMap((node) => [node, ...flattenContentNodes(node.nodes ?? [])]);

export const validateEditorDocument = (
	document: WorkflowDefinitionEditorDocument,
	catalog: NodeTypeCatalog,
): WorkflowDefinitionEditorIssue[] => {
	const issues: WorkflowDefinitionEditorIssue[] = [];
	const nodeIssue = (
		node: WorkflowDefinitionEditorNode,
		message: string,
		extra?: Pick<WorkflowDefinitionEditorIssue, 'path' | 'severity'>,
	) => issues.push({ nodeId: node.id, scope: node.parentId, message, ...extra });
	const requireText = (node: WorkflowDefinitionEditorNode, value: string | undefined, label: string) => {
		if (!value?.trim()) nodeIssue(node, `${label} is required`);
	};
	const checkDuration = (node: WorkflowDefinitionEditorNode, value: string | null | undefined, label: string) => {
		if (value && !isDuration(value)) nodeIssue(node, `${label} must be a duration like 30s or 5m`);
	};

	// Nodes are checked exactly as they would be saved.
	const content = toWorkflowDefinitionContent(document, catalog);
	const saved = new Map(flattenContentNodes(content.nodes).map((node) => [node.id, node]));

	/** The node's fields against its catalog schema. Graph fields are the canvas's to check. */
	const checkSchema = (node: WorkflowDefinitionEditorNode) => {
		const { type } = node.config;
		const item = catalog.byType[type];
		if (!item) {
			nodeIssue(node, `"${type}" isn't a node type this engine lists`, { severity: 'warning' });
			return;
		}
		const validation = nodeTypeValidation(item);
		if (validation.kind === 'unsupported') {
			nodeIssue(node, `${nodeTypeMetaOf(type, item).label} fields are checked by the engine on save`, {
				severity: 'warning',
			});
			return;
		}
		if (validation.kind !== 'checked') return;
		for (const issue of validation.validate(saved.get(node.id))) {
			if (typeof issue.path[0] === 'string' && GRAPH_FIELDS.has(issue.path[0])) continue;
			nodeIssue(node, issue.message, { path: issue.path.join('.') || undefined });
		}
	};

	// A node definition is named by its node, whose name is checked with the other nodes.
	const rootId = document.nodeDefinition?.rootId;
	if (!document.nodeDefinition && !document.name.trim()) {
		issues.push({ nodeId: null, scope: null, message: 'Workflow name is required' });
	}

	const checkScope = (scope: string | null, label: string) => {
		if (scopeNodes(document.nodes, scope).length === 0) {
			issues.push({ nodeId: scope, scope, message: `${label} needs at least one node` });
		} else if (!outgoingTarget(document.edges, startNodeId(scope), HANDLE_NEXT)) {
			issues.push({ nodeId: scope, scope, message: `Connect Start to the first node of ${label.toLowerCase()}` });
		}

		const keyTargets = new Map<string, string | null>();
		for (const node of scopeNodes(document.nodes, scope)) {
			if (node.config.type !== 'conditions') continue;
			// The engine rejects `keys` anywhere in a node definition: the workflow using it routes the branches.
			if (document.nodeDefinition) {
				if (node.branches.some((branch) => outgoingTarget(document.edges, node.id, branchHandle(branch.id)))) {
					nodeIssue(
						node,
						'Branches of a node definition are routed by each workflow that uses it; disconnect them here',
					);
				}
				continue;
			}
			for (const branch of node.branches) {
				const key = branch.key.trim();
				const target = outgoingTarget(document.edges, node.id, branchHandle(branch.id));
				if (!key) {
					if (target) nodeIssue(node, 'Name every branch key that leads to a node');
					continue;
				}
				if (keyTargets.has(key) && keyTargets.get(key) !== target) {
					nodeIssue(node, `Branch key "${key}" already routes somewhere else in this scope`);
				}
				keyTargets.set(key, target);
			}
		}
	};
	if (!document.nodeDefinition) checkScope(null, 'The workflow');

	const broken = new Set<string>();
	for (const node of Object.values(document.nodes)) {
		const { config } = node;
		requireText(node, config.name, 'Name');

		for (const [field, text] of Object.entries(node.jsonDrafts)) {
			if (!parseJsonDraft(text).ok) {
				nodeIssue(node, `${humanizeKey(field.split('.').at(-1) ?? field)} is not valid JSON`, { path: field });
			}
		}

		if (outgoingTarget(document.edges, node.id, HANDLE_FAILURE)) {
			requireText(node, node.failureOutputProperty, 'Failure output property');
		}
		// References may carry start_delay (null disables the library's), so these run before the reference skip.
		// The served schemas don't describe start_delay, so it's checked here.
		if (config.start_delay !== undefined && !supportsStartDelay(config.type)) {
			nodeIssue(node, `${nodeTypeMetaOf(config.type).label} nodes don't support start delay`);
		}
		checkDuration(node, config.start_delay ?? undefined, 'Start delay');
		if (config.node_definition_id && config.delay !== undefined) {
			nodeIssue(node, "Delay can't be set on a library reference");
		}

		if (config.node_definition_id) continue;

		checkSchema(node);

		// What the canvas owns: branches, scopes and parallel pairs.
		switch (config.type) {
			case 'conditions':
				if (node.branches.length < 2) nodeIssue(node, 'Conditions need at least two branches');
				if (node.branches.some((branch) => !branch.condition.trim())) {
					nodeIssue(node, 'Every branch needs a condition script');
				}
				break;
			case 'group':
				checkScope(node.id, `Group "${config.name}"`);
				break;
			case 'input':
				for (const { message, path } of inputAcceptIssues(config)) nodeIssue(node, message, { path });
				break;
			case 'parallel_start':
				// A parallel_start definition carries graph ids of the workflow it was made for; only the engine checks them.
				if (node.id === rootId) break;
				if (!checkParallelStart(document, node, (message) => nodeIssue(node, message))) broken.add(node.id);
				break;
			case 'parallel_end':
				if (node.id !== rootId) checkParallelEnd(document, node, (message) => nodeIssue(node, message));
				for (const message of combiningScriptWarnings(document, node)) {
					issues.push({ nodeId: node.id, scope: node.parentId, message, severity: 'warning' });
				}
				break;
		}
	}

	// Convergence and depth run on exactly what would be saved. A start that is already structurally broken would
	// only repeat its problem as walk noise, so it is left out.
	const reported = new Set(issues.map((issue) => `${issue.nodeId}\u0000${issue.message}`));
	const analysis = analyzeParallel(content);
	const failedBranches = new Set(
		analysis.problems
			.filter((problem) => problem.kind !== 'no_path')
			.map((problem) => `${problem.startId}\u0000${problem.branch}`),
	);
	for (const problem of analysis.problems) {
		if (broken.has(problem.startId) || problem.startId === rootId) continue;
		// Condition keys come from the workflow using a node definition, so they can't be resolved here.
		if (document.nodeDefinition && problem.kind === 'missing_key') continue;
		// "No path" follows from any other problem on the same branch, like the engine stopping at the first error.
		if (problem.kind === 'no_path' && failedBranches.has(`${problem.startId}\u0000${problem.branch}`)) continue;
		const node = document.nodes[problem.nodeId] ?? document.nodes[problem.startId];
		if (!node) continue;
		const message = parallelProblemMessage(problem);
		const key = `${node.id}\u0000${message}`;
		if (reported.has(key)) continue;
		reported.add(key);
		nodeIssue(node, message);
	}

	return issues;
};

const parallelProblemMessage = ({ kind, branch, detail }: ParallelProblem) => {
	switch (kind) {
		case 'dead_end':
			return `Branch "${branch}" reaches this node, which never leads to the join`;
		case 'escape':
			return `Branch "${branch}" leaves the parallel's scope`;
		case 'unknown_node':
			return `Branch "${branch}" reaches an unknown node`;
		case 'self_loop':
			return `Branch "${branch}" loops back to its own parallel`;
		case 'missing_key':
			return `Branch "${branch}" routes through key "${detail}", which this scope doesn't define`;
		case 'no_path':
			return `Branch "${branch}" has no path to the join`;
		case 'too_deep':
			return `Parallel blocks nest deeper than ${MAX_PARALLEL_DEPTH} (this one is ${detail} deep)`;
		case 'nested_cycle':
			return 'This parallel is nested in its own branches';
	}
};

/** The engine's rules tying an input node's `accept`, `channel` and `storage` together. */
export const inputAcceptIssues = (config: Pick<WorkflowDefinitionNode, 'accept' | 'channel' | 'storage'>) => {
	const issues: { message: string; path: string }[] = [];
	const multipart = !!config.accept?.includes('multipart/form-data');
	if (config.accept && config.accept.length === 0) {
		issues.push({ message: 'Accept at least one body type', path: 'accept' });
	}
	if (multipart && config.channel !== 'http') {
		issues.push({ message: 'Multipart input needs the http channel', path: 'accept' });
	}
	// An empty bucket is the schema check's to report; this covers storage left out altogether.
	if (multipart && !config.storage) {
		issues.push({ message: 'Multipart input needs a storage bucket for its files', path: 'storage.bucket' });
	}
	if (!multipart && config.storage) {
		issues.push({
			message: 'Storage is only used by multipart input; remove it or accept multipart',
			path: 'storage',
		});
	}
	return issues;
};

/** The pair link both halves must agree on: the partner exists, is the other half, points back and shares the scope. */
const pairedPartner = (
	document: WorkflowDefinitionEditorDocument,
	node: WorkflowDefinitionEditorNode,
	type: WorkflowDefinitionNodeType,
) => {
	const partner = node.pairId ? document.nodes[node.pairId] : undefined;
	return partner?.config.type === type && partner.pairId === node.id && partner.parentId === node.parentId
		? partner
		: undefined;
};

/** Reports the structural problems of a parallel_start; false when it has any. */
const checkParallelStart = (
	document: WorkflowDefinitionEditorDocument,
	node: WorkflowDefinitionEditorNode,
	report: (message: string) => void,
) => {
	let valid = true;
	const fail = (message: string) => {
		valid = false;
		report(message);
	};

	if (node.branches.length < MIN_PARALLEL_BRANCHES) {
		fail(`A parallel needs at least ${MIN_PARALLEL_BRANCHES} branches`);
	} else if (node.branches.length > MAX_PARALLEL_BRANCHES) {
		fail(`A parallel can have at most ${MAX_PARALLEL_BRANCHES} branches`);
	}

	const names = new Set<string>();
	const duplicates = new Set<string>();
	for (const branch of node.branches) {
		const name = branch.key.trim();
		if (names.has(name)) duplicates.add(name);
		names.add(name);
	}
	if (names.has('')) fail('Every branch needs a name');
	for (const name of duplicates) if (name) fail(`Branch name "${name}" is used more than once`);

	let unconnected = false;
	for (const branch of node.branches) {
		const target = outgoingTarget(document.edges, node.id, branchHandle(branch.id));
		const label = branch.key.trim() || 'Unnamed branch';
		if (!target) unconnected = true;
		else if (target === node.id) fail(`Branch "${label}" can't lead back to its own parallel`);
		else if (document.nodes[target]?.parentId !== node.parentId) {
			fail(`Branch "${label}" must lead to a node in the same scope`);
		}
	}
	if (unconnected) fail('Connect every branch to the node it starts at');

	if (!pairedPartner(document, node, 'parallel_end')) {
		const partner = node.pairId ? document.nodes[node.pairId] : undefined;
		if (!partner || partner.config.type !== 'parallel_end') fail('This parallel has no join');
		else if (partner.pairId !== node.id) fail(`Join "${partner.config.name}" already closes another parallel`);
		else fail('The join must be in the same scope as its parallel');
	}
	return valid;
};

const checkParallelEnd = (
	document: WorkflowDefinitionEditorDocument,
	node: WorkflowDefinitionEditorNode,
	report: (message: string) => void,
) => {
	if (pairedPartner(document, node, 'parallel_start')) return;
	const partner = node.pairId ? document.nodes[node.pairId] : undefined;
	if (partner?.config.type === 'parallel_start' && partner.pairId === node.id) {
		report('The join must be in the same scope as its parallel');
	} else {
		report('This join has no matching parallel');
	}
};

const SCRIPT_COMMENTS = /\/\*[\s\S]*?\*\/|\/\/.*$/gm;
// `branch["x"]`, `branch['x']` and `branch.x`, but not `context.branch.x` or `mybranch.x`.
const BRANCH_READS = /(?<![\w$.])branch\s*(?:\[\s*(["'])((?:(?!\1)[^\\\n])*)\1\s*\]|\.\s*([A-Za-z_$][\w$]*))/g;

/** Branch names the combining script reads that its parallel doesn't have, e.g. after a rename. Never rewritten. */
const combiningScriptWarnings = (document: WorkflowDefinitionEditorDocument, node: WorkflowDefinitionEditorNode) => {
	const start = pairedPartner(document, node, 'parallel_start');
	if (!start || node.config.node_definition_id) return [];
	const names = new Set(start.branches.map((branch) => branch.key.trim()));
	const missing = new Set<string>();
	for (const match of (node.config.combining_script ?? '').replace(SCRIPT_COMMENTS, '').matchAll(BRANCH_READS)) {
		const name = match[2] ?? match[3];
		if (!names.has(name)) missing.add(name);
	}
	return [...missing].map(
		(name) => `Combining script reads branch "${name}", which "${start.config.name}" doesn't have`,
	);
};

export const collectReferenceIds = (nodes: WorkflowDefinitionNode[]): string[] =>
	nodes.flatMap((node) => [
		...(node.node_definition_id ? [node.node_definition_id] : []),
		...collectReferenceIds(node.nodes ?? []),
	]);

export const descendantIds = (nodes: Record<string, WorkflowDefinitionEditorNode>, id: string): string[] =>
	scopeNodes(nodes, id).flatMap((child) => [child.id, ...descendantIds(nodes, child.id)]);

export const scopeTrail = (nodes: Record<string, WorkflowDefinitionEditorNode>, scope: string | null) => {
	const trail: WorkflowDefinitionEditorNode[] = [];
	let current = scope ? nodes[scope] : undefined;
	while (current) {
		trail.unshift(current);
		current = current.parentId ? nodes[current.parentId] : undefined;
	}
	return trail;
};
