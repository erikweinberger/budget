import { db } from './index';
import { categories, categoryKeywords } from './schema';

const DEFAULT_CATEGORIES = [
  {
    name: 'Other',
    color: '#6B7280',
    isDefault: true,
    keywords: [],
  },
  {
    name: 'Groceries',
    color: '#16A34A',
    isDefault: false,
    keywords: ['WOOLWORTHS', 'COLES', 'ALDI', 'COSTCO', 'IGA', 'MIRACLE SUPERMARKET', 'WW METRO', 'SUPAMART'],
  },
  {
    name: 'Transport',
    color: '#2563EB',
    isDefault: false,
    keywords: ['TRANSPORTFORNSW', 'OPAL'],
  },
  {
    name: 'Subscriptions',
    color: '#7C3AED',
    isDefault: false,
    keywords: ['GOOGLE', 'YOUTUBE', 'AMAYSIM', 'SNAP FITNE', 'NETFLIX', 'SPOTIFY'],
  },
  {
    name: 'Eat Out',
    color: '#EA580C',
    isDefault: false,
    keywords: ['KFC', 'YOSUSHI', 'BWS', 'BAKERY', 'ROMEOS', 'NANCHO', 'DELI', 'CHARGRILL', 'SQ *', 'ZLR*', 'MCDONALD', 'HUNGRY JACK'],
  },
  {
    name: 'Shopping',
    color: '#DB2777',
    isDefault: false,
    keywords: ['KMART', 'TARGET', 'DAVID JONES', 'WITCHERY', 'MYER', 'SEPHORA', 'IKEA', 'AMAZON', 'BUNNINGS', 'COSTCO WHOLESALE'],
  },
  {
    name: 'Bills',
    color: '#DC2626',
    isDefault: false,
    keywords: ['BP ', 'COSTCO GAS', 'ENERGY', 'WATER'],
  },
  {
    name: 'Petrol',
    color: '#D97706',
    isDefault: false,
    keywords: ['BP OAKES', 'COSTCO GAS'],
  },
];

export async function seed() {
  const existing = await db.select().from(categories);
  if (existing.length > 0) {
    console.log(`Categories already seeded (${existing.length} found), skipping.`);
    return;
  }

  console.log('Seeding categories...');

  for (const cat of DEFAULT_CATEGORIES) {
    const [inserted] = await db
      .insert(categories)
      .values({ name: cat.name, color: cat.color, isDefault: cat.isDefault })
      .returning();

    if (inserted && cat.keywords.length > 0) {
      await db.insert(categoryKeywords).values(
        cat.keywords.map((kw) => ({ categoryId: inserted.id, keyword: kw }))
      );
    }
  }

  console.log('Seed complete.');
}
