import type { WorkflowDefinitionInputAccept } from '@module/workflow-definition/types/WorkflowDefinitionInputAccept';
import type { WorkflowDefinitionInputStorage } from '@module/workflow-definition/types/WorkflowDefinitionInputStorage';

export const JSON_TYPE: WorkflowDefinitionInputAccept = 'application/json';
export const MULTIPART_TYPE: WorkflowDefinitionInputAccept = 'multipart/form-data';

/** `accept` with multipart added or removed. Taking multipart away also drops `storage`, which the engine then rejects. */
export const withMultipart = (
	accept: WorkflowDefinitionInputAccept[] | undefined,
	on: boolean,
): { accept?: WorkflowDefinitionInputAccept[]; storage?: WorkflowDefinitionInputStorage | null } => {
	const current = accept?.length ? accept : [JSON_TYPE];
	if (on) return { accept: current.includes(MULTIPART_TYPE) ? current : [...current, MULTIPART_TYPE] };
	const rest = current.filter((type) => type !== MULTIPART_TYPE);
	// JSON alone is the engine default, so it's left unset.
	return { accept: rest.length === 1 && rest[0] === JSON_TYPE ? undefined : rest, storage: undefined };
};
