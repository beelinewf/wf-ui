import type { WorkflowDefinitionInputChannel } from '@module/workflow-definition/types/WorkflowDefinitionInputChannel';

import type { WorkflowRunPendingInputForm } from './WorkflowRunPendingInputForm';

export interface WorkflowRunPendingInput {
	node_id: string;
	channel: WorkflowDefinitionInputChannel;
	output_property: string;
	/** Forms-library form to render for this input; absent when the node references none. */
	form_id?: string | null;
	/** The form frozen at start, for a run started with `snapshot_forms`; absent otherwise. */
	form?: WorkflowRunPendingInputForm | null;
	/** The bodies the node takes; absent is JSON only. */
	accept?: string[];
}
