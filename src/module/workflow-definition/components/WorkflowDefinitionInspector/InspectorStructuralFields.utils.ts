import { useCoreSelector } from '@core/store';

import { selectEditorNodes } from '@module/workflow-definition/store';
import type { WorkflowDefinitionEditorNode } from '@module/workflow-definition/types/WorkflowDefinitionEditorNode';

/** The other half of a parallel block, when both point at each other. */
export const usePartner = (node: WorkflowDefinitionEditorNode) => {
	const nodes = useCoreSelector(selectEditorNodes);
	const partner = node.pairId ? nodes[node.pairId] : undefined;
	return partner?.pairId === node.id ? partner : undefined;
};

const DEFAULT_CONTEXT_DECLARATION = 'declare const context: Record<string, any>;';

/** `branch` typed from the paired start's names, next to the loaded (or generic) `context` declaration. */
export const branchDeclaration = (contextTypes: string | undefined, names: string[]) =>
	[
		contextTypes ?? DEFAULT_CONTEXT_DECLARATION,
		'interface BeelineParallelBranch {',
		'\t/** The branch context when it finished. A frozen copy: assign to `context` to keep values. */',
		'\treadonly context: Record<string, any>;',
		'\treadonly status: string;',
		'\treadonly branch_id: string;',
		'\treadonly start_node_id: string;',
		'}',
		'/** Every branch of the paired parallel, by name. Read-only. */',
		`declare const branch: { readonly [name: string]: BeelineParallelBranch } & {`,
		...names.map((name) => `\treadonly ${JSON.stringify(name)}: BeelineParallelBranch;`),
		'};',
	].join('\n');
