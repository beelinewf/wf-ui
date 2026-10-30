/** Where the account comes from: a password account, an OIDC identity, or the API token's system user. */
export type UserSource = 'local' | 'sso' | 'system';

export type UserStatus = 'active' | 'pending' | 'disabled';
