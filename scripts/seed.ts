import { config } from 'dotenv';
config({ path: '.env.local' });

import { seed } from '../lib/db/seed';

seed().catch(console.error);
