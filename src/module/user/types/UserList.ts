import type { User } from './User';

export interface UserList {
	items: User[];
	page: number;
	per_page: number;
	total: number;
	total_pages: number;
}
