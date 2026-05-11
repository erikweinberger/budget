import { parse } from 'csv-parse/sync';
import type { RawTransaction } from './westpac-pdf';

const SKIP_PATTERNS = [
  /^C\d+\s+TFR FROM/i,
  /^CRED VOUCHER/i,
];

export function parseCSV(content: string): RawTransaction[] {
  const records: string[][] = parse(content, { skip_empty_lines: true, relax_column_count: true });
  if (records.length === 0) return [];

  // Find header row
  const headerIdx = records.findIndex((row) =>
    row.some((cell) => /date/i.test(cell))
  );
  if (headerIdx === -1) return [];

  const headers = records[headerIdx].map((h) => h.toLowerCase().trim());
  const dateIdx = headers.findIndex((h) => h === 'date');
  const descIdx = headers.findIndex((h) => /description|details|narrative/i.test(h));
  const debitIdx = headers.findIndex((h) => /debit|withdrawal/i.test(h));
  const creditIdx = headers.findIndex((h) => /credit|deposit/i.test(h));
  const amountIdx = headers.findIndex((h) => h === 'amount');
  // Card member / cardholder name column (Amex and similar)
  const nameIdx = headers.findIndex((h) =>
    /card\s*member|card\s*holder|cardholder|account\s*holder|member\s*name|holder\s*name/i.test(h)
  );

  const transactions: RawTransaction[] = [];

  for (const row of records.slice(headerIdx + 1)) {
    if (row.length <= Math.max(dateIdx, descIdx)) continue;

    const rawDate = row[dateIdx]?.trim();
    const description = row[descIdx]?.trim();
    if (!description) continue;
    if (SKIP_PATTERNS.some((p) => p.test(description))) continue;

    let amount: number | null = null;

    if (debitIdx >= 0 && row[debitIdx]?.trim()) {
      // Explicit debit column (bank-style): take whatever is there
      amount = Math.abs(parseFloat(row[debitIdx].replace(/[$,]/g, '')));
    } else if (amountIdx >= 0) {
      const val = parseFloat(row[amountIdx].replace(/[$,]/g, ''));
      // Bank CSV: expenses are negative. Credit card CSV (Amex): expenses are positive.
      // Accept both — take absolute value of any non-zero amount.
      if (!isNaN(val) && val !== 0) amount = Math.abs(val);
    }

    if (!amount || isNaN(amount)) continue;

    // Normalise date to YYYY-MM-DD (empty string means "use today" — handled upstream)
    let isoDate = '';
    if (rawDate) {
      isoDate = rawDate;
      const dmyMatch = rawDate.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      if (dmyMatch) {
        isoDate = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
      }
    }

    const name = (nameIdx >= 0 ? row[nameIdx]?.trim() : undefined) || undefined;

    transactions.push({ date: isoDate, description, amount: amount.toFixed(2), name });
  }

  return transactions;
}
