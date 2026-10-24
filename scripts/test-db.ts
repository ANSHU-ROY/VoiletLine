// scripts/test-db.ts
import initSqlJs from 'sql.js';

async function test() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run('CREATE TABLE users (id TEXT, name TEXT);');
  db.run('INSERT INTO users VALUES (?, ?);', ['u1', 'Aarav Sharma']);
  const res = db.exec('SELECT * FROM users;');
  console.log('Result from SQL.js:', JSON.stringify(res));
}

test().catch(console.error);
