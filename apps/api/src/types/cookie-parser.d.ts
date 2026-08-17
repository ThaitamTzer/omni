// Minimal type declaration for cookie-parser (dependency install blocked by npm bug on this machine)
declare module 'cookie-parser' {
  import { RequestHandler } from 'express';
  function cookieParser(secret?: string | string[]): RequestHandler;
  export = cookieParser;
}
