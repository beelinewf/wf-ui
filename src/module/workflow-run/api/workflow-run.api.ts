import { v4 as uuidv4 } from 'uuid';

import { API_TAG_LIST_ID, apiTagConfig } from '@config/apiTag.config';

import { coreApi } from '@core/api';

import type { WorkflowRun } from '@module/workflow-run/types/WorkflowRun';
import type { WorkflowRunDebugContext } from '@module/workflow-run/types/WorkflowRunDebugContext';
import type { WorkflowRunDebugContextQuery } from '@module/workflow-run/types/WorkflowRunDebugContextQuery';
import type { WorkflowRunDetail } from '@module/workflow-run/types/WorkflowRunDetail';
import type { WorkflowRunList } from '@module/workflow-run/types/WorkflowRunList';
import type { WorkflowRunMigratePayload } from '@module/workflow-run/types/WorkflowRunMigratePayload';
import type { WorkflowRunMigrateResult } from '@module/workflow-run/types/WorkflowRunMigrateResult';
import type { WorkflowRunNodeDebug } from '@module/workflow-run/types/WorkflowRunNodeDebug';
import type { WorkflowRunQuery } from '@module/workflow-run/types/WorkflowRunQuery';
import {
	toRunDetail,
	toRunNodeDebug,
	type WorkflowRunNodeDebugResponse,
	type WorkflowRunStatusResponse,
} from '@module/workflow-run/utils/workflow-run.mapper';

const RESOURCE = 'v1/workflow/instance';

export interface WorkflowRunNodeDebugQuery {
	id: string;
	/** Graph node ids with their current occurrence; a new occurrence or status refetches. */
	nodes: { nodeId: string; occurrenceId: string; status: string; attempt: number }[];
}

export const workflowRunApi = coreApi.injectEndpoints({
	endpoints: (build) => ({
		listWorkflowRuns: build.query<WorkflowRunList, WorkflowRunQuery>({
			query: (param) => ({ method: 'get', url: RESOURCE, qParam: param }),
			providesTags: (result) => [
				{ type: apiTagConfig.workflowRun, id: API_TAG_LIST_ID },
				...(result?.items ?? []).map((item) => ({ type: apiTagConfig.workflowRun, id: item.id })),
			],
		}),

		/** Page-accumulating variant of the list for scroll-to-load views; `page` is driven by the cache. */
		listWorkflowRunPages: build.infiniteQuery<WorkflowRunList, Omit<WorkflowRunQuery, 'page'>, number>({
			infiniteQueryOptions: {
				initialPageParam: 1,
				getNextPageParam: (lastPage) => (lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined),
			},
			query: ({ queryArg, pageParam }) => ({
				method: 'get',
				url: RESOURCE,
				qParam: { ...queryArg, page: pageParam },
			}),
			providesTags: (result) => [
				{ type: apiTagConfig.workflowRun, id: API_TAG_LIST_ID },
				...(result?.pages ?? []).flatMap((page) =>
					page.items.map((item) => ({ type: apiTagConfig.workflowRun, id: item.id })),
				),
			],
		}),

		getWorkflowRun: build.query<WorkflowRunDetail, string>({
			query: (id) => ({ method: 'get', url: `${RESOURCE}/${id}/status` }),
			transformResponse: (res: WorkflowRunStatusResponse) => toRunDetail(res),
			providesTags: (_result, _error, id) => [{ type: apiTagConfig.workflowRun, id }],
		}),

		/**
		 * Debug detail of every executed node, keyed by occurrence id. Fetched by occurrence id: the engine
		 * resolves a graph node id in the parent scope only, which misses nodes run inside parallel branches.
		 */
		getWorkflowRunNodeDebugs: build.query<Record<string, WorkflowRunNodeDebug>, WorkflowRunNodeDebugQuery>({
			queryFn: async ({ id, nodes }, _api, _extra, baseQuery) => {
				const results = await Promise.all(
					nodes.map((node) =>
						baseQuery({
							method: 'get',
							url: `${RESOURCE}/${id}/status/node/${encodeURIComponent(node.occurrenceId)}`,
						}),
					),
				);

				const debug: Record<string, WorkflowRunNodeDebug> = {};
				for (const result of results) {
					if (result.error) return { error: result.error };
					const node = toRunNodeDebug(result.data as WorkflowRunNodeDebugResponse);
					debug[node.occurrence_id] = node;
				}
				return { data: debug };
			},
			providesTags: (_result, _error, { id }) => [{ type: apiTagConfig.workflowRun, id }],
		}),

		/** Debug runs only: the engine answers 409 for a run started without `debug`. */
		getWorkflowRunDebugContext: build.query<WorkflowRunDebugContext, WorkflowRunDebugContextQuery>({
			query: ({ id, nodeId, attempt }) => ({
				method: 'get',
				url: `${RESOURCE}/${id}/debug/context`,
				qParam: {
					filter: {
						...(nodeId ? { node_id: { op: '_eq', value: nodeId } } : {}),
						...(attempt ? { attempt: { op: '_eq', value: attempt } } : {}),
					},
				},
			}),
			providesTags: (_result, _error, { id }) => [{ type: apiTagConfig.workflowRun, id }],
		}),

		getWorkflowRunContext: build.query<Record<string, unknown>, string>({
			query: (id) => ({ method: 'get', url: `${RESOURCE}/${id}/context` }),
			transformResponse: (res: { id: string; context: Record<string, unknown> | null }) => res.context ?? {},
			providesTags: (_result, _error, id) => [{ type: apiTagConfig.workflowRun, id }],
		}),

		replaceWorkflowRunContext: build.mutation<
			Record<string, unknown>,
			{ id: string; context: Record<string, unknown>; reason?: string }
		>({
			query: ({ id, context, reason }) => ({
				method: 'put',
				url: `${RESOURCE}/${id}/context`,
				body: context,
				head: reason ? { 'X-Context-Update-Reason': reason } : undefined,
			}),
			transformResponse: (res: { id: string; context: Record<string, unknown> | null }) => res.context ?? {},
			invalidatesTags: (_result, _error, { id }) => [{ type: apiTagConfig.workflowRun, id }],
		}),

		/** `branchId` delivers to a parallel branch parked on an http input; the parent must be parked on the join. */
		provideWorkflowRunInput: build.mutation<
			{ accepted: boolean },
			{ id: string; payload: unknown | FormData; branchId?: string }
		>({
			query: ({ id, payload, branchId }) => ({
				method: 'put',
				url: `${RESOURCE}/${id}/input`,
				qParam: branchId ? { filter: { branch_id: { op: '_eq', value: branchId } } } : undefined,
				// FormData goes out as multipart. Anything else is pre-serialised so a bare string/number still goes out as JSON.
				body: payload instanceof FormData ? payload : JSON.stringify(payload),
				head: { 'Idempotency-Key': uuidv4() },
			}),
			invalidatesTags: (_result, _error, { id }) => [{ type: apiTagConfig.workflowRun, id }],
		}),

		rollbackWorkflowRun: build.mutation<
			Pick<WorkflowRunDetail, 'status' | 'current_node_id'>,
			{ id: string; targetOccurrenceId: string; reason?: string }
		>({
			query: ({ id, targetOccurrenceId, reason }) => ({
				method: 'post',
				url: `${RESOURCE}/${id}/rollback`,
				body: { target_occurrence_id: targetOccurrenceId, reason: reason || undefined },
			}),
			invalidatesTags: (_result, _error, { id }) => [{ type: apiTagConfig.workflowRun, id }],
		}),

		/** Starts a replacement run on a newer definition and stops the source in the same transaction. */
		migrateWorkflowRun: build.mutation<WorkflowRunMigrateResult, WorkflowRunMigratePayload>({
			query: ({ id, ...body }) => ({ method: 'post', url: `${RESOURCE}/${id}/migrate`, body }),
			invalidatesTags: (result, _error, { id }) => [
				{ type: apiTagConfig.workflowRun, id },
				{ type: apiTagConfig.workflowRun, id: API_TAG_LIST_ID },
				...(result ? [{ type: apiTagConfig.workflowRun, id: result.instance.id }] : []),
			],
		}),

		pauseWorkflowRun: build.mutation<Pick<WorkflowRun, 'status' | 'pause_requested'>, string>({
			query: (id) => ({ method: 'post', url: `${RESOURCE}/${id}/pause` }),
			invalidatesTags: (_result, _error, id) => [{ type: apiTagConfig.workflowRun, id }],
		}),

		resumeWorkflowRun: build.mutation<Pick<WorkflowRun, 'status'>, string>({
			query: (id) => ({ method: 'post', url: `${RESOURCE}/${id}/resume` }),
			invalidatesTags: (_result, _error, id) => [{ type: apiTagConfig.workflowRun, id }],
		}),

		stopWorkflowRun: build.mutation<Pick<WorkflowRun, 'status' | 'termination_pending'>, string>({
			query: (id) => ({ method: 'post', url: `${RESOURCE}/${id}/stop` }),
			invalidatesTags: (_result, _error, id) => [{ type: apiTagConfig.workflowRun, id }],
		}),

		startWorkflowRun: build.mutation<
			Pick<WorkflowRun, 'id' | 'status'>,
			{ workflowDefinitionId: string; debug?: boolean; snapshotForms?: boolean }
		>({
			query: ({ workflowDefinitionId, debug, snapshotForms }) => ({
				method: 'post',
				url: RESOURCE,
				body: {
					workflow_definition_id: workflowDefinitionId,
					...(debug ? { debug: true } : {}),
					...(snapshotForms ? { snapshot_forms: true } : {}),
				},
			}),
			invalidatesTags: [{ type: apiTagConfig.workflowRun, id: API_TAG_LIST_ID }],
		}),
	}),
});
