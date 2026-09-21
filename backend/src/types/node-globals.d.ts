/**
 * TEMPORARY ambient declarations.
 * This sandbox has no network access to `npm install @types/node`.
 * In a real dev environment, run `npm i -D @types/node` and DELETE this file —
 * the real type definitions are far more complete than this stand-in.
 */

declare var process: {
  env: Record<string, string | undefined>;
};

declare function structuredClone<T>(value: T): T;

declare module 'crypto' {
  export function randomBytes(size: number): BufferLike;
  export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean;
  export function scryptSync(password: string, salt: string, keylen: number): BufferLike;
  export function createHmac(algorithm: string, key: Uint8Array | string): { update(data: Uint8Array | string): unknown; digest(): BufferLike };
}

declare module 'http' {
  export interface IncomingMessage extends AsyncIterable<BufferLike> {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
    destroy(error?: Error): void;
  }
  export interface ServerResponse {
    statusCode: number;
    setHeader(name: string, value: string | string[]): void;
    end(data?: string): void;
  }
  export interface Server {
    listen(port: number, callback?: () => void): Server;
    close(callback?: (err?: Error) => void): void;
    address(): { port: number } | null;
  }
  export function createServer(requestListener: (req: IncomingMessage, res: ServerResponse) => void): Server;
}

declare class URLSearchParams {
  constructor(init?: string);
  get(name: string): string | null;
  getAll(name: string): string[];
  entries(): IterableIterator<[string, string]>;
}

declare class URL {
  constructor(input: string, base?: string);
  pathname: string;
  searchParams: URLSearchParams;
}

interface BufferLike extends Uint8Array {
  toString(encoding?: string): string;
}
declare var Buffer: {
  from(input: string, encoding?: string): BufferLike;
  alloc(size: number): BufferLike;
};
