import { SQL } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { PgliteDatabase } from "drizzle-orm/pglite";

export type TDatabase = NodePgDatabase<any> | PgliteDatabase<any>;

export interface IDatabaseClientManager<T> {
    initialize(): Promise<void>;
    getConnection(): T;
    runMigrations(): Promise<void>;
    close(): Promise<void>;
}

export interface DrizzleOperations {
    select: (...args: any[]) => any;
    selectDistinct: (...args: any[]) => any;
    insert: (...args: any[]) => any;
    update: (...args: any[]) => any;
    delete: (...args: any[]) => any;
    transaction: <T>(cb: (tx: any) => Promise<T>) => Promise<T>;
    execute<T = Record<string, unknown>>(
        query: SQL
    ): Promise<{ rows: any[] } & Record<string, any>>;
}

export type DrizzleDatabase = NodePgDatabase | PgliteDatabase;

export type DatabaseType = DrizzleDatabase & DrizzleOperations;
