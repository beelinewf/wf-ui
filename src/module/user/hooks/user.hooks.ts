import { userApi } from '@module/user/api';

export const {
	useListUsersQuery,
	useGetUserQuery,
	useCreateUserMutation,
	useUpdateUserMutation,
	useDisableUserMutation,
	useResendUserVerificationMutation,
} = userApi;
