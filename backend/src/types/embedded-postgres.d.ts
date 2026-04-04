declare module 'embedded-postgres' {
  export interface PostgresOptions {
    databaseDir?: string;
    user?: string;
    password?: string;
    port?: number;
    persistent?: boolean;
    initdbFlags?: string[];
  }

  export default class EmbeddedPostgres {
    constructor(options?: Partial<PostgresOptions>);
    initialise(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    createDatabase(name: string): Promise<void>;
    dropDatabase(name: string): Promise<void>;
  }
}
