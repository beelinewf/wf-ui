import type { WorkflowDefinitionExecutionConfig } from './WorkflowDefinitionExecutionConfig';
import type { WorkflowDefinitionFailureRoute } from './WorkflowDefinitionFailureRoute';
import type { WorkflowDefinitionHookScript } from './WorkflowDefinitionHookScript';
import type { WorkflowDefinitionHTTPConfig } from './WorkflowDefinitionHTTPConfig';
import type { WorkflowDefinitionInputChannel } from './WorkflowDefinitionInputChannel';
import type { WorkflowDefinitionNodeCondition } from './WorkflowDefinitionNodeCondition';
import type { WorkflowDefinitionNodeType } from './WorkflowDefinitionNodeType';
import type { WorkflowDefinitionPollerHTTPConfig } from './WorkflowDefinitionPollerHTTPConfig';
import type { WorkflowDefinitionPollerRabbitMQConfig } from './WorkflowDefinitionPollerRabbitMQConfig';
import type { WorkflowDefinitionPollerRedisConfig } from './WorkflowDefinitionPollerRedisConfig';

export interface WorkflowDefinitionNode {
	id: string;
	type: WorkflowDefinitionNodeType;
	name: string;
	node_definition_id?: string;
	next_node?: string | null;
	on_failure?: WorkflowDefinitionFailureRoute | null;
	output_property?: string;
	timeout?: string | null;
	/** Waits this long on arrival before the node runs. Null only on references: disables the definition's delay. */
	start_delay?: string | null;
	retry_on_recovery?: boolean;
	metadata?: Record<string, unknown>;
	pre_script?: WorkflowDefinitionHookScript | null;
	post_script?: WorkflowDefinitionHookScript | null;

	script?: string;
	input_data?: string;

	conditions?: WorkflowDefinitionNodeCondition[];

	channel?: WorkflowDefinitionInputChannel;
	context_path?: string;
	validation?: { script: string };
	/** input: the forms-library form the frontend renders for this node. */
	form_id?: string;
	allowed_roles?: string[];
	/** input: users.id uuids allowed to deliver, a union with allowed_roles. */
	allowed_users?: { id: string }[];
	record_actor?: boolean;
	public?: boolean;

	http_config?: WorkflowDefinitionHTTPConfig;
	execution_config?: WorkflowDefinitionExecutionConfig;

	http?: WorkflowDefinitionPollerHTTPConfig;
	redis?: WorkflowDefinitionPollerRedisConfig;
	rabbitmq?: WorkflowDefinitionPollerRabbitMQConfig;

	/** parallel_start: branch name to the node it forks into. */
	branches?: Record<string, string>;
	/** parallel_start: the join node closing the region. */
	parallel_end_node_id?: string;
	/** parallel_end: merges the branch contexts. */
	combining_script?: string;

	/** delay: how long the node waits before continuing at next_node. */
	delay?: string;

	start_node_id?: string;
	keys?: Record<string, string | null>;
	nodes?: WorkflowDefinitionNode[];
}
