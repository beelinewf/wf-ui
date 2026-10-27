import { useStoreApi, useReactFlow } from '@xyflow/react';

import { useCoreDispatch, useCoreStore } from '@core/store';

import { useAppLayoutPanel } from '@module/app/hooks';
import { selectPanelInsets } from '@module/app/store';
import type { NodeDefinition } from '@module/node-definition/types/NodeDefinition';
import { selectNodeTypeCatalog } from '@module/node-type/utils';
import {
	jsonDraftChanged,
	nodeAdded,
	nodeConfigChanged,
	nodeRawChanged,
	nodeSelected,
	scopeEntered,
	selectEditorNodes,
	selectEditorScope,
	selectEditorStarts,
} from '@module/workflow-definition/store';
import type { WorkflowDefinitionEditorBranch } from '@module/workflow-definition/types/WorkflowDefinitionEditorBranch';
import type { WorkflowDefinitionEditorIssue } from '@module/workflow-definition/types/WorkflowDefinitionEditorIssue';
import type { WorkflowDefinitionJsonField } from '@module/workflow-definition/types/WorkflowDefinitionJsonField';
import type { WorkflowDefinitionNodeConfig } from '@module/workflow-definition/types/WorkflowDefinitionNodeConfig';
import type { WorkflowDefinitionNodeType } from '@module/workflow-definition/types/WorkflowDefinitionNodeType';
import { createEditorNode, createParallelPair, scopeKey } from '@module/workflow-definition/utils';

export type WorkflowDefinitionPaletteItem = { type: WorkflowDefinitionNodeType } | { definition: NodeDefinition };

export const PALETTE_DRAG_TYPE = 'application/x-beeline-node';

const NODE_ANCHOR = { x: 110, y: 30 };
const FREE_SPOT_GAP = { x: 240, y: 110 };

export const useWorkflowDefinitionEditorAddNode = () => {
	const dispatch = useCoreDispatch();
	const store = useCoreStore();
	const flow = useReactFlow();
	const flowStore = useStoreApi();

	return (item: WorkflowDefinitionPaletteItem, screenPoint?: { x: number; y: number }) => {
		const state = store.getState();
		const nodes = selectEditorNodes(state);
		const scope = selectEditorScope(state);
		const catalog = selectNodeTypeCatalog(state);

		let point = screenPoint;
		if (!point) {
			const rect = flowStore.getState().domNode?.getBoundingClientRect();
			if (!rect) return;
			// The centre of what the floating layout panels leave visible.
			const insets = selectPanelInsets(state);
			point = {
				x: rect.left + (rect.width + insets.left - insets.right) / 2,
				y: rect.top + (rect.height + insets.top - insets.bottom) / 2,
			};
		}

		const center = flow.screenToFlowPosition(point);
		const position = { x: center.x - NODE_ANCHOR.x, y: center.y - NODE_ANCHOR.y };

		if (!screenPoint) {
			const start = selectEditorStarts(state)[scopeKey(scope)];
			const occupied = [
				...Object.values(nodes).filter((node) => node.parentId === scope),
				...(start ? [start] : []),
			];
			const isFree = () =>
				occupied.every(
					(node) =>
						Math.abs(node.position.x - position.x) >= FREE_SPOT_GAP.x ||
						Math.abs(node.position.y - position.y) >= FREE_SPOT_GAP.y,
				);
			for (let attempt = 0; attempt < 20 && !isFree(); attempt++) position.y += FREE_SPOT_GAP.y;
		}

		if ('type' in item && item.type === 'parallel_start') {
			// The join is added first so the start ends up selected.
			const [start, end] = createParallelPair(nodes, scope, position, catalog);
			dispatch(nodeAdded(end));
			dispatch(nodeAdded(start));
			return;
		}
		dispatch(nodeAdded(createEditorNode(nodes, scope, position, item, catalog)));
	};
};

export const useWorkflowDefinitionEditorNodeActions = (id: string) => {
	const dispatch = useCoreDispatch();

	return {
		patch: (patch: Partial<WorkflowDefinitionNodeConfig>) => dispatch(nodeConfigChanged({ id, patch })),
		replaceRaw: (config: WorkflowDefinitionNodeConfig, branches?: WorkflowDefinitionEditorBranch[]) =>
			dispatch(nodeRawChanged({ id, config, branches })),
		setJsonDraft: (field: WorkflowDefinitionJsonField, text: string | null) =>
			dispatch(jsonDraftChanged({ id, field, text })),
	};
};

/** Shows the node an issue is about: enters its scope, selects it and opens its settings. */
export const useFocusEditorIssue = () => {
	const dispatch = useCoreDispatch();
	const store = useCoreStore();
	const panel = useAppLayoutPanel();

	return (issue: WorkflowDefinitionEditorIssue) => {
		const node = issue.nodeId ? selectEditorNodes(store.getState())[issue.nodeId] : undefined;
		dispatch(scopeEntered(node ? node.parentId : issue.scope));
		dispatch(nodeSelected(node?.id ?? null));
		if (node) panel.open('right');
	};
};
