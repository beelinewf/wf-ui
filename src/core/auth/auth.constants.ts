export const AUTH_TOKEN_HEADER = 'X-Api-Token';

export const AUTH_BEARER_HEADER = 'Authorization';

export const AUTH_LOGIN_PATH = '/auth/login';

export const AUTH_CALLBACK_PATH = '/auth/callback';

export const AUTH_REGISTER_PATH = '/auth/register';

export const AUTH_RESEND_VERIFICATION_PATH = '/auth/resend-verification';

// Top level, not under /auth: the engine mails {auth.local.public_base_url}/verify-email?token=…
export const AUTH_VERIFY_EMAIL_PATH = '/verify-email';

// How long a resend button stays disabled after a send, so the inbox has a chance to receive it.
export const RESEND_COOLDOWN_SECONDS = 60;

export const AUTH_HOME_PATH = '/app';

// offline_access is what makes the provider issue a refresh token; the backend's scope list does not carry it.
export const OAUTH_EXTRA_SCOPES = ['offline_access'];

// Refresh this long before the access token expires, so a request never leaves with a token that dies in flight.
export const OAUTH_REFRESH_LEEWAY_MS = 30_000;

// Placeholder session for an engine with every login method disabled; such an engine ignores the header.
export const AUTH_ANONYMOUS_TOKEN = 'anonymous';
