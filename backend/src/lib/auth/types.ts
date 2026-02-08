export interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export interface AuthUser {
  userId: string;
  email: string;
}

export interface AuthResult {
  user: AuthUser;
}
