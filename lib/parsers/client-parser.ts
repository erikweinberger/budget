export interface RawTransaction {
  date: string;
  description: string;
  amount: string;
  name?: string;
}

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

function parseDate(raw: string): string {
  const [day, mon, year] = raw.split(' ');
  return `${year}-${MONTHS[mon]}-${day.padStart(2, '0')}`;
}

const SKIP_PATTERNS = [/^C\d+\s+TFR FROM/i, /^CRED VOUCHER/i];

async function extractPDFLines(buffer: ArrayBuffer): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const lines: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    const byY = new Map<number, string[]>();
    for (const item of content.items) {
      if ('str' in item && item.str.trim()) {
        const y = Math.round((item as { transform: number[] }).transform[5]);
        if (!byY.has(y)) byY.set(y, []);
        byY.get(y)!.push(item.str);
      }
    }

    const sorted = Array.from(byY.entries()).sort((a, b) => b[0] - a[0]);
    for (const [, items] of sorted) lines.push(items.join(' '));
  }

  return lines;
}

function parseWestpacLines(lines: string[]): RawTransaction[] {
  const DATE_RE =
    /^(\d{2}\s+[A-Za-z]{3}\s+\d{4})\s+(.+?)\s+(-?\$[\d,]+\.\d{2})\s*(-?\$[\d,]+\.\d{2})?$/;
  const out: RawTransaction[] = [];

  for (const line of lines) {
    const m = line.match(DATE_RE);
    if (!m) continue;
    const [, rawDate, description, col1, col2] = m;
    if (SKIP_PATTERNS.some((p) => p.test(description.trim()))) continue;

    const val1 = parseFloat(col1.replace(/[$,]/g, ''));
    const val2 = col2 ? parseFloat(col2.replace(/[$,]/g, '')) : NaN;
    let debit: number | null = null;
    if (val1 < 0) debit = Math.abs(val1);
    else if (!isNaN(val2) && val2 < 0) debit = Math.abs(val2);
    if (debit === null) continue;

    out.push({ date: parseDate(rawDate), description: description.trim(), amount: debit.toFixed(2) });
  }

  return out;
}

function parseCSVClient(content: string): RawTransaction[] {
  function splitRow(line: string): string[] {
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

  const rows = content
    .split('\n')
    .map(splitRow)
    .filter((r) => r.some((c) => c));

  const headerIdx = rows.findIndex((r) => r.some((c) => /date/i.test(c)));
  if (headerIdx === -1) return [];

  const headers = rows[headerIdx].map((h) => h.toLowerCase().trim());
  const dateIdx = headers.findIndex((h) => h === 'date');
  const descIdx = headers.findIndex((h) => /description|details|narrative/i.test(h));
  const debitIdx = headers.findIndex((h) => /debit|withdrawal/i.test(h));
  const amountIdx = headers.findIndex((h) => h === 'amount');
  const nameIdx = headers.findIndex((h) =>
    /card\s*member|card\s*holder|cardholder|account\s*holder|member\s*name|holder\s*name/i.test(h),
  );

  const out: RawTransaction[] = [];
  for (const row of rows.slice(headerIdx + 1)) {
    if (row.length <= Math.max(dateIdx, descIdx)) continue;
    const rawDate = row[dateIdx]?.trim();
    const description = row[descIdx]?.trim();
    if (!description) continue;
    if (SKIP_PATTERNS.some((p) => p.test(description))) continue;

    let amount: number | null = null;
    if (debitIdx >= 0 && row[debitIdx]?.trim()) {
      amount = Math.abs(parseFloat(row[debitIdx].replace(/[$,]/g, '')));
    } else if (amountIdx >= 0) {
      const v = parseFloat(row[amountIdx].replace(/[$,]/g, ''));
      if (!isNaN(v) && v !== 0) amount = Math.abs(v);
    }
    if (!amount || isNaN(amount)) continue;

    let isoDate = rawDate ?? '';
    if (isoDate) {
      const dmy = isoDate.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      if (dmy) isoDate = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    }

    const name = (nameIdx >= 0 ? row[nameIdx]?.trim() : undefined) || undefined;
    out.push({ date: isoDate, description, amount: amount.toFixed(2), name });
  }

  return out;
}

export async function parseFileClient(file: File): Promise<RawTransaction[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) {
    const buf = await file.arrayBuffer();
    const lines = await extractPDFLines(buf);
    return parseWestpacLines(lines);
  }
  if (name.endsWith('.csv')) {
    return parseCSVClient(await file.text());
  }
  throw new Error('Unsupported file type. Upload a PDF or CSV.');
}
