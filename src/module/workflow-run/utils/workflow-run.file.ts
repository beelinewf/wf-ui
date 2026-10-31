import type { WorkflowRunFileRef } from '@module/workflow-run/types/WorkflowRunFileRef';

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** A file the engine stored from a multipart delivery, as it sits in the context. */
export const isFileRef = (value: unknown): value is WorkflowRunFileRef =>
	isRecord(value) &&
	typeof value.original_file_name === 'string' &&
	typeof value.file_name === 'string' &&
	typeof value.size === 'number' &&
	typeof value.mime_type === 'string';

/** A multipart file part's value: the engine writes every key as a list. */
export const isFileRefList = (value: unknown): value is WorkflowRunFileRef[] =>
	Array.isArray(value) && value.length > 0 && value.every(isFileRef);

export interface WorkflowRunFileRefGroup {
	/** Dotted path to the list, e.g. `upload.attachments`; empty when the value is the list itself. */
	path: string;
	files: WorkflowRunFileRef[];
}

// A delivery lands at `output_property.key`, under `input_data` with record_actor; a little deeper covers branches.
const MAX_DEPTH = 4;

/** The file-ref lists in `value`, by path. */
export const collectFileRefs = (value: unknown, path = '', depth = 0): WorkflowRunFileRefGroup[] => {
	if (isFileRefList(value)) return [{ path, files: value }];
	if (!isRecord(value) || depth >= MAX_DEPTH) return [];
	return Object.entries(value).flatMap(([key, item]) =>
		collectFileRefs(item, path ? `${path}.${key}` : key, depth + 1),
	);
};
