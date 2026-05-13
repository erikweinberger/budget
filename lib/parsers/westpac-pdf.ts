import { extractText, getDocumentProxy } from 'unpdf';

async function extractPDFText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

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

const SKIP_PATTERNS = [
  /^C\d+\s+TFR FROM/i,
  /^CRED VOUCHER/i,
];

export async function parseWestpacPDF(buffer: Buffer): Promise<RawTransaction[]> {
  const text = await extractPDFText(buffer);
  const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean);

  const DATE_RE = /^(\d{2}\s+[A-Za-z]{3}\s+\d{4})\s+(.+?)\s+(-?\$[\d,]+\.\d{2})\s*(-?\$[\d,]+\.\d{2})?$/;

  const transactions: RawTransaction[] = [];

  for (const line of lines) {
    const match = line.match(DATE_RE);
    if (!match) continue;

    const [, rawDate, description, col1, col2] = match;

    if (SKIP_PATTERNS.some((p) => p.test(description.trim()))) continue;

    const val1 = parseFloat(col1.replace(/[$,]/g, ''));
    const val2 = col2 ? parseFloat(col2.replace(/[$,]/g, '')) : NaN;

    let debitVal: number | null = null;
    if (val1 < 0) debitVal = Math.abs(val1);
    else if (!isNaN(val2) && val2 < 0) debitVal = Math.abs(val2);

    if (debitVal === null) continue;

    transactions.push({
      date: parseDate(rawDate),
      description: description.trim(),
      amount: debitVal.toFixed(2),
    });
  }

  return transactions;
}
