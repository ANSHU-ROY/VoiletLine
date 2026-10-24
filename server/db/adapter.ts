// server/db/adapter.ts
export interface IDatabaseAdapter {
  query<T = any>(sql: string, params?: any[]): T[];
  queryOne<T = any>(sql: string, params?: any[]): T | null;
  execute(sql: string, params?: any[]): { changes: number; lastInsertRowid: number | bigint };
  transaction<T>(fn: () => T): T;
  close(): void;
}
