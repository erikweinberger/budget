import { config } from 'dotenv';
config({ path: '.env.local' });
import { readFileSync } from 'fs';
import { parseCSV } from '../lib/parsers/csv';

const content = readFileSync('Design/amex_activity_8-Apr_to_7-May.csv', 'utf-8');
const results = parseCSV(content);
console.log(`Parsed ${results.length} transactions`);
results.slice(0, 5).forEach(t => console.log(`  ${t.date}  ${t.description.slice(0, 40).padEnd(40)}  $${t.amount}`));
