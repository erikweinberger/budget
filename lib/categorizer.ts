import { db } from '@/lib/db';

export interface ParsedExpense {
  date: string;
  title: string;
  rawDescription: string;
  amount: string;
}

export async function categorize(expenses: ParsedExpense[]): Promise<(ParsedExpense & { categoryId: number | null })[]> {
  const cats = await db.query.categories.findMany({
    with: { keywords: true },
    orderBy: (c, { asc, desc }) => [desc(c.isDefault), asc(c.name)],
  });

  // Default (Other) is the one with isDefault=true
  const defaultCat = cats.find((c) => c.isDefault) ?? null;
  // Non-default cats, checked in order
  const matchable = cats.filter((c) => !c.isDefault);

  return expenses.map((expense) => {
    const desc = expense.rawDescription.toUpperCase();
    let categoryId = defaultCat?.id ?? null;

    for (const cat of matchable) {
      const matched = cat.keywords.some((kw) => desc.includes(kw.keyword.toUpperCase()));
      if (matched) {
        categoryId = cat.id;
        break;
      }
    }

    return { ...expense, categoryId };
  });
}
