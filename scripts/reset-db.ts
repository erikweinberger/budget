import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function reset() {
  console.log('Dropping all tables...');
  await sql`DROP TABLE IF EXISTS expense_splits CASCADE`;
  await sql`DROP TABLE IF EXISTS expenses CASCADE`;
  await sql`DROP TABLE IF EXISTS board_members CASCADE`;
  await sql`DROP TABLE IF EXISTS boards CASCADE`;
  await sql`DROP TABLE IF EXISTS category_keywords CASCADE`;
  await sql`DROP TABLE IF EXISTS categories CASCADE`;
  await sql`DROP TABLE IF EXISTS users CASCADE`;
  console.log('All tables dropped.');
}

reset().catch(console.error);
