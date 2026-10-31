<img src="./src/assets/banner.png" />

# Beeline

A workflow UI for [Beeline Workflow Engine](https://github.com/beelinewf/wf-engine).

## Run locally

You need [Node.js 24](https://nodejs.org/en/download) and a running Beeline Workflow Engine.

```
npm install
npm run dev
```

Runtime config for dev lives in [`public/config.json`](./public/config.json). Dev server proxies the relative `BEELINE_UI_API` path (`/wf-engine`) to `http://localhost:8080`. If your workflow engine runs somewhere else:

```
BEELINE_API_PROXY=http://localhost:9999 npm run dev
```

## Docker

```
docker run -p 8080:80 \
  -e BEELINE_UI_API=http://your-wf-engine:9999 \
  ghcr.io/beelinewf/wf-ui
```

Env:

- `BEELINE_UI_NAME` - app name, default `Beeline`
- `BEELINE_UI_API` - workflow engine API url, default `http://localhost:9999`
- `BEELINE_UI_IDP_ADMIN_URL` - optional, identity provider admin page linked from Settings → Roles
- `BEELINE_UI_ORG_URL` - optional, link behind the copyright on the login page, default `https://github.com/beelinewf`

The backend doesn't send CORS headers, so you probably need to put both behind same reverse proxy.

## Email login without SSO

For an organization without an identity provider, turn on the engine's built-in email and password login. The login page then shows **Email** first, and users are managed under Users.

Engine settings (`config.yaml`):

- `auth.enabled: true`
- `auth.local.enabled: true` with a `auth.local.jwt_secret` of at least 32 bytes
- `auth.local.allow_registration: true` to let people sign up themselves (otherwise an admin creates accounts)
- `auth.local.public_base_url` pointing at this UI's origin, e.g. `https://wf.example.com`. Verification emails link to `{public_base_url}/verify-email?token=…`
- `auth.local.email_verification.enabled: true` plus the `auth.local.smtp` settings to require a verified email before sign-in. For local testing, `smtp.host: log` writes the link to the engine log instead of sending mail.

The first admin has to come from somewhere: create them with the API token (`POST /v1/users` with a role that holds `users:write` and `roles:write`), then sign in with Email.

If the UI and engine are on different origins, add `Retry-After` to `infra.http.cors.exposed_headers` so the login and register pages can show how long a rate limit lasts. Otherwise they fall back to a 30-second wait.

## File inputs

A form can have **File upload** fields. They have to be top level, not inside a group or repeater. A form with them is set to the **Multipart** content type. Its input node has to accept multipart on the `http` channel, and name a storage bucket.

Engine settings (`config.yaml`):

- `infra.storage` (endpoint, region, keys) pointing at S3-compatible storage. Without it, definitions still save, but a multipart delivery fails.
- `engine.multipart` sets the upload limits (files per request, total, per file). A breach answers 413, which the input modal shows.

A multipart delivery is flat: every part name is a top-level context key and every key arrives as a list. Text parts are `string[]`, and values other than strings are sent as JSON strings. File parts are `{ original_file_name, file_name, size, mime_type }[]`. The engine has no download endpoint, so run views list the stored `file_name` but can't fetch the file.

## License

MIT. See [LICENSE](./LICENSE).

Copyright (c) 2026 BeelineWF And Contributors.
