import type { RawTransaction } from './westpac-pdf';

const SKIP_PATTERNS = [/^C\d+\s+TFR FROM/i, /^CRED VOUCHER/i];

function splitCSVRow(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; }
    else { cur += ch; }
  }
  cells.push(cur.trim());
  return cells;
}

export function parseCSV(content: string): RawTransaction[] {
  const records = content
    .split('\n')
    .map(splitCSVRow)
    .filter((r) => r.some((c) => c.trim()));

  if (records.length === 0) return [];

  const headerIdx = records.findIndex((row) => row.some((cell) => /date/i.test(cell)));
  if (headerIdx === -1) return [];

  const headers = records[headerIdx].map((h) => h.toLowerCase().trim());
  const dateIdx = headers.findIndex((h) => h === 'date');
  const descIdx = headers.findIndex((h) => /description|details|narrative/i.test(h));
  const debitIdx = headers.findIndex((h) => /debit|withdrawal/i.test(h));
  const amountIdx = headers.findIndex((h) => h === 'amount');
  const nameIdx = headers.findIndex((h) =>
    /card\s*member|card\s*holder|cardholder|account\s*holder|member\s*name|holder\s*name/i.test(h),
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
      amount = Math.abs(parseFloat(row[debitIdx].replace(/[$,]/g, '')));
    } else if (amountIdx >= 0) {
      const val = parseFloat(row[amountIdx].replace(/[$,]/g, ''));
      if (!isNaN(val) && val !== 0) amount = Math.abs(val);
    }
    if (!amount || isNaN(amount)) continue;

    let isoDate = rawDate ?? '';
    if (isoDate) {
      const dmy = isoDate.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      if (dmy) isoDate = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    }

    const name = (nameIdx >= 0 ? row[nameIdx]?.trim() : undefined) || undefined;
    transactions.push({ date: isoDate, description, amount: amount.toFixed(2), name });
  }

  return transactions;
}
