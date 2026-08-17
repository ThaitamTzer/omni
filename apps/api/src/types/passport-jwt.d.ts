// Minimal type declarations for passport-jwt (dependency install blocked by npm bug on this machine)
declare module 'passport-jwt' {
  import { Request } from 'express';
  import { Strategy as PassportStrategy, VerifyCallback } from 'passport-strategy';

  export interface JwtFromRequestFunction {
    (req: Request): string | null;
  }

  export interface StrategyOptions {
    jwtFromRequest: JwtFromRequestFunction;
    secretOrKey?: string | Buffer;
    ignoreExpiration?: boolean;
    jsonWebTokenOptions?: Record<string, unknown>;
  }

  export const ExtractJwt: {
    fromAuthHeaderAsBearerToken: () => JwtFromRequestFunction;
  };

  export class Strategy extends PassportStrategy {
    constructor(options: StrategyOptions, verify?: (payload: unknown, done: VerifyCallback) => void);
  }
}
