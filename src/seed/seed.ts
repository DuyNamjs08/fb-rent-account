import fs from 'fs';
import { Client } from 'pg';
import path from 'path';
import 'dotenv/config';

async function runSQL() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    const sqlPath = path.resolve(__dirname, '../sql/seed.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);
    console.log('Seed thành công');
  } catch (err) {
    console.error('Lỗi khi chạy seed:', err);
  } finally {
    await client.end();
  }
}

runSQL();
