import { config } from 'dotenv';
config({ path: '.env.local' });
import { readFileSync } from 'fs';
import { parseCSV } from '../lib/parsers/csv';

const content = readFileSync('Design/amex_activity_as_of_10-05-26.csv', 'utf-8');
const results = parseCSV(content);
console.log(`Parsed ${results.length} transactions`);
results.forEach(t => console.log(`  ${t.date}  ${(t.name ?? '—').padEnd(15)}  ${t.description.slice(0, 35)}`));
