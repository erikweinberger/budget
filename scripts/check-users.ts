import { config } from 'dotenv';
config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`SELECT id, username FROM users ORDER BY id`;
  console.log(rows.length === 0 ? 'No users in DB' : JSON.stringify(rows, null, 2));
}
main();
