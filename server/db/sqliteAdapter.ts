// server/db/sqliteAdapter.ts
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { IDatabaseAdapter } from './adapter.js';
import fs from 'fs';
import path from 'path';

export class SQLiteAdapter implements IDatabaseAdapter {
  private db: SqlJsDatabase;
  private dbPath: string;
  private dirty = false;
  private saveTimeout: NodeJS.Timeout | null = null;

  private constructor(db: SqlJsDatabase, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
  }

  static async create(customPath?: string): Promise<SQLiteAdapter> {
    const SQL = await initSqlJs();
    const resolvedPath = customPath || path.resolve(process.cwd(), 'data', 'violetlink.db');
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let db: SqlJsDatabase;
    if (fs.existsSync(resolvedPath)) {
      const buffer = fs.readFileSync(resolvedPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    const adapter = new SQLiteAdapter(db, resolvedPath);
    return adapter;
  }

  private scheduleSave() {
    this.dirty = true;
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.persist();
      this.saveTimeout = null;
    }, 150);
  }

  public persist() {
    if (this.dbPath === ':memory:' || !this.dirty) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
      this.dirty = false;
    } catch (err) {
      console.error('Error persisting database:', err);
    }
  }

  query<T = any>(sql: string, params: any[] = []): T[] {
    try {
      const stmt = this.db.prepare(sql);
      if (params.length > 0) {
        stmt.bind(params);
      }
      const results: T[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as T);
      }
      stmt.free();
      return results;
    } catch (err) {
      console.error('SQL query error:', sql, params, err);
      throw err;
    }
  }

  queryOne<T = any>(sql: string, params: any[] = []): T | null {
    const results = this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  execute(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number | bigint } {
    try {
      if (params.length > 0) {
        this.db.run(sql, params);
      } else {
        this.db.run(sql);
      }
      this.scheduleSave();
      return {
        changes: this.db.getRowsModified(),
        lastInsertRowid: 0
      };
    } catch (err) {
      console.error('SQL execute error:', sql, params, err);
      throw err;
    }
  }

  transaction<T>(fn: () => T): T {
    this.db.run('BEGIN TRANSACTION;');
    try {
      const result = fn();
      this.db.run('COMMIT;');
      this.scheduleSave();
      return result;
    } catch (err) {
      this.db.run('ROLLBACK;');
      throw err;
    }
  }

  close(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.persist();
    this.db.close();
  }
}
