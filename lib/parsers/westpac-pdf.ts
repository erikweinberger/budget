// pdfjs-dist (used by pdf-parse) references DOMMatrix which doesn't exist in Node.js serverless
if (typeof globalThis.DOMMatrix === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).DOMMatrix = class DOMMatrix {
    a=1; b=0; c=0; d=1; e=0; f=0;
    m11=1; m12=0; m13=0; m14=0; m21=0; m22=1; m23=0; m24=0;
    m31=0; m32=0; m33=1; m34=0; m41=0; m42=0; m43=0; m44=1;
    is2D=true; isIdentity=true;
    constructor(_init?: unknown) {}
    multiply() { return this; }
    translate() { return this; }
    scale() { return this; }
    rotate() { return this; }
    inverse() { return this; }
    transformPoint(p: unknown) { return p; }
  };
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require('pdf-parse') as {
  PDFParse: new (opts: { data: Buffer }) => {
    load(): Promise<void>;
    getText(): Promise<{ pages: { text: string }[] }>;
  };
};

async function extractPDFText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  await parser.load();
  const result = await parser.getText();
  return result.pages.map((p) => p.text).join('\n');
}

export interface RawTransaction {
  date: string;           // ISO YYYY-MM-DD
  description: string;
  amount: string;         // positive number as string (we only return debits)
  name?: string;  // cardholder/card member name if available
}

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

function parseDate(raw: string): string {
  // "08 May 2026" → "2026-05-08"
  const [day, mon, year] = raw.split(' ');
  return `${year}-${MONTHS[mon]}-${day.padStart(2, '0')}`;
}

function cleanTitle(description: string): string {
  // Remove trailing "SUBURB AUS" or " AUS" patterns
  return description
    .replace(/\s+[A-Z\s]+\s+AUS\s*$/i, '')
    .replace(/\s+AUS\s*$/i, '')
    .trim();
}

const SKIP_PATTERNS = [
  /^C\d+\s+TFR FROM/i,       // internal transfers
  /^CRED VOUCHER/i,           // credit vouchers / refunds
];

export async function parseWestpacPDF(buffer: Buffer): Promise<RawTransaction[]> {
  const text = await extractPDFText(buffer);
  const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean);

  const DATE_RE = /^(\d{2}\s+[A-Za-z]{3}\s+\d{4})\s+(.+?)\s+(-?\$[\d,]+\.\d{2})\s*(-?\$[\d,]+\.\d{2})?$/;
  // Some PDFs have debit and credit in separate columns; we try both orderings

  const transactions: RawTransaction[] = [];

  for (const line of lines) {
    const match = line.match(DATE_RE);
    if (!match) continue;

    const [, rawDate, description, col1, col2] = match;

    // Skip non-expense lines
    if (SKIP_PATTERNS.some((p) => p.test(description.trim()))) continue;

    // Determine which column is debit (negative value)
    const val1 = parseFloat(col1.replace(/[$,]/g, ''));
    const val2 = col2 ? parseFloat(col2.replace(/[$,]/g, '')) : NaN;

    let debitVal: number | null = null;
    if (val1 < 0) debitVal = Math.abs(val1);
    else if (!isNaN(val2) && val2 < 0) debitVal = Math.abs(val2);

    if (debitVal === null) continue; // credit-only row, skip

    transactions.push({
      date: parseDate(rawDate),
      description: description.trim(),
      amount: debitVal.toFixed(2),
    });
  }

  return transactions;
}
