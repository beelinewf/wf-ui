export interface AuthConfig {
	/** True when an OIDC provider is configured and bearer tokens are accepted. */
	enabled: boolean;
	api_token_enabled: boolean;
	/** True when the built-in email/password login is on. */
	local_enabled: boolean;
	/** True when anyone may self-register; otherwise local users come from an admin. */
	registration_enabled: boolean;
	/** True when a registered account stays pending until its mailed link is used. */
	email_verification_enabled: boolean;
	// The OIDC fields may be absent or empty on a deployment without SSO.
	issuer?: string;
	client_id?: string;
	audience?: string;
	authorization_url?: string;
	token_url?: string;
	roles_claim?: string;
	scopes?: string[];
	roles: string[];
}

/** The config once SSO is known to be on, with the fields the code+PKCE flow needs. */
export type OidcAuthConfig = AuthConfig &
	Required<Pick<AuthConfig, 'issuer' | 'client_id' | 'authorization_url' | 'token_url' | 'scopes'>>;
