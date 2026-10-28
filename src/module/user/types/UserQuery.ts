import type { ComplexQueryParam } from '@common/types/ComplexQueryParam';

/** The users list only supports pagination, newest first. */
export type UserQuery = Pick<ComplexQueryParam, 'page' | 'perPage'>;
