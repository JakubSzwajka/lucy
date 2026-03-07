# Auth Module

JWT signing/verification and request-level auth guards.

## Public API

- `signToken(payload)`, `verifyToken(token)`
- `requireAuth(request)`
- `optionalAuth(request)`
- types: `JWTPayload`, `AuthUser`, `AuthResult`

## Use It Like This

```ts
const authResult = await requireAuth(request);
if ("error" in authResult) return authResult.error;
const { userId } = authResult.user;
```

## Responsibility Boundary

Auth module only handles token concerns and auth extraction.
Authorization/business rules stay in services/routes.
