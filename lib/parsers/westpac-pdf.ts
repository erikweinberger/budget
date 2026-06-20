import { getDocumentProxy } from 'unpdf';

async function extractPDFLines(buffer: Buffer): Promise<string[]> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
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

export interface RawTransaction {
  date: string;
  description: string;
  amount: string;
  name?: string;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const SKIP_PATTERNS = [/^C\d+\s+TFR FROM/i, /^CRED VOUCHER/i];

const WESTPAC_MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

function parseWestpacDate(raw: string): string {
  const [day, mon, year] = raw.split(' ');
  return `${year}-${WESTPAC_MONTHS[mon]}-${day.padStart(2, '0')}`;
}

// ─── Westpac Transaction Search format ───────────────────────────────────────
// 3-line layout per transaction:
//   Altitude Qantas Black Card [Description]
//   DD Mon YYYY  [-$Amount]
//   xxxx xxxx xx38 5675  [Location]

const WESTPAC_DATE_RE = /^(\d{2}\s+[A-Za-z]{3}\s+\d{4})\s*(.*)/;
const CARD_LINE_RE = /^xxxx\s+xxxx/i;
const ACCT_PREFIX_RE = /^Altitude\s+\S+\s+\S+\s+\S+\s*/i;

function getDebits(s: string): number[] {
  return Array.from(s.matchAll(/-?\$[\d,]+\.\d{2}/g))
    .map((m) => parseFloat(m[0].replace(/[$,]/g, '')))
    .filter((n) => n < 0);
}

function parseTransactionSearch(lines: string[]): RawTransaction[] {
  const out: RawTransaction[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const dateMatch = line.match(WESTPAC_DATE_RE);
    if (!dateMatch) continue;

    const rawDate = dateMatch[1];
    const restOfLine = dateMatch[2];

    // Debit amount: on current line or the line immediately below
    let amount: number | null = null;
    const d1 = getDebits(line)[0];
    if (d1 !== undefined) {
      amount = Math.abs(d1);
    } else if (i + 1 < lines.length) {
      const next = lines[i + 1];
      if (!WESTPAC_DATE_RE.test(next) && !CARD_LINE_RE.test(next)) {
        const d2 = getDebits(next)[0];
        if (d2 !== undefined) amount = Math.abs(d2);
      }
    }
    if (amount === null) continue;

    // Description: line above (strip account-name prefix), or two lines above if line above was just account name
    let description = '';
    if (i > 0 && !CARD_LINE_RE.test(lines[i - 1])) {
      description = lines[i - 1].replace(ACCT_PREFIX_RE, '').trim();
      if (!description && i > 1 && !CARD_LINE_RE.test(lines[i - 2]) && !WESTPAC_DATE_RE.test(lines[i - 2])) {
        description = lines[i - 2].replace(ACCT_PREFIX_RE, '').trim();
      }
    }
    // Fallback: description embedded in the date line itself
    if (!description && restOfLine) {
      description = restOfLine.replace(/-?\$[\d,]+\.\d{2}/g, '').replace(/FRGN AMT:.*$/i, '').trim();
    }

    if (!description) continue;
    if (SKIP_PATTERNS.some((p) => p.test(description))) continue;
    if (/FOREIGN\s*FEE/i.test(description)) continue;

    out.push({ date: parseWestpacDate(rawDate), description: description.trim(), amount: amount.toFixed(2) });
  }

  return out;
}

// Classic single-line Westpac statement format:
// "DD Mon YYYY Description -$XX.XX [-$Balance]"
function parseStatementFormat(lines: string[]): RawTransaction[] {
  const LINE_RE =
    /^(\d{2}\s+[A-Za-z]{3}\s+\d{4})\s+(.+?)\s+(-?\$[\d,]+\.\d{2})\s*(-?\$[\d,]+\.\d{2})?$/;
  const out: RawTransaction[] = [];

  for (const line of lines) {
    const m = line.match(LINE_RE);
    if (!m) continue;
    const [, rawDate, description, col1, col2] = m;
    if (SKIP_PATTERNS.some((p) => p.test(description.trim()))) continue;

    const val1 = parseFloat(col1.replace(/[$,]/g, ''));
    const val2 = col2 ? parseFloat(col2.replace(/[$,]/g, '')) : NaN;
    let debit: number | null = null;
    if (val1 < 0) debit = Math.abs(val1);
    else if (!isNaN(val2) && val2 < 0) debit = Math.abs(val2);
    if (debit === null) continue;

    out.push({ date: parseWestpacDate(rawDate), description: description.trim(), amount: debit.toFixed(2) });
  }

  return out;
}

// ─── American Express format ──────────────────────────────────────────────────
// 2-line layout per transaction:
//   MERCHANT NAME LOCATION          ← description line (may include foreign-spend amount at end)
//   Mon DD  [Description]  Amount   ← date+amount line (description sometimes on this line)
//
// Credits have "CR" on the line immediately after the date+amount line.

const AMEX_MONTHS: Record<string, string> = {
  January: '01', February: '02', March: '03', April: '04', May: '05', June: '06',
  July: '07', August: '08', September: '09', October: '10', November: '11', December: '12',
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', Jun: '06', Jul: '07',
  Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

const AMEX_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
  'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
].join('|');

const AMEX_DATE_RE = new RegExp(`^(${AMEX_MONTH_NAMES})\\s+(\\d{1,2})\\s+`);

const AMEX_SKIP = [
  /^CR$/,
  /^Total\s+(New|of)/i,
  /^New\s+(Standard|Payments)/i,
  /^Card\s+Number/i,
  /^TRANSACTION\s+DATE/i,
  /^TRANSACTION\s+DETAILS/i,
  /^Prepared\s+for/i,
  /^Statement\s+of\s+Account/i,
  /^(UNITED\s+(STATES|KINGDOM)|EURO)/i,
  /AUD\s+[\d.]+\s+includes\s+conversion/i,
  /PayID\s+Payment/i,
  /americanexpress/i,
  /^Qantas\s+American/i,
  /^OPENING\s+BALANCE/i,
  /^CREDIT\s+(SUMMARY|LIMIT)/i,
  /^MINIMUM\s+REPAYMENT/i,
];

function isAmexSkip(line: string): boolean {
  return AMEX_SKIP.some((p) => p.test(line.trim()));
}

function parseAmexStatement(lines: string[], fullText: string): RawTransaction[] {
  // Extract statement year — use 202x+ to avoid matching postcodes like NSW 2001
  const yearMatch = fullText.match(/\b(20[2-9]\d)\b/);
  const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

  function makeDate(mon: string, day: string): string {
    return `${year}-${AMEX_MONTHS[mon]}-${day.padStart(2, '0')}`;
  }

  let currentCardholder = '';
  const CARDHOLDER_RE = /New\s+Standard\s+Transactions\s+for:\s+(.+)/i;
  const AMOUNT_AT_END = /([\d,]+\.\d{2})$/;

  const out: RawTransaction[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cardholderMatch = line.match(CARDHOLDER_RE);
    if (cardholderMatch) {
      currentCardholder = cardholderMatch[1].trim();
      continue;
    }

    if (isAmexSkip(line)) continue;

    const dateMatch = line.match(AMEX_DATE_RE);
    if (!dateMatch) continue;

    const [fullDateStr, mon, day] = dateMatch;
    const afterDate = line.slice(fullDateStr.length);

    // Amount is always at the end of the date line
    const amtMatch = afterDate.match(AMOUNT_AT_END);
    if (!amtMatch) continue;

    const amount = parseFloat(amtMatch[1].replace(/,/g, ''));

    // Skip credits (CR appears on the next non-empty line)
    const nextLine = lines.slice(i + 1).find((l) => l.trim())?.trim() ?? '';
    if (nextLine === 'CR') continue;

    // Description: text between date and amount on the current line
    const descInLine = afterDate.slice(0, amtMatch.index!).trim();
    let description = descInLine;

    // If not on the date line, look at the line above
    if (!description && i > 0) {
      let prevLine = lines[i - 1].trim();
      if (!isAmexSkip(prevLine) && !AMEX_DATE_RE.test(prevLine) && prevLine) {
        // Strip trailing foreign-spend amount (a number that isn't the AUD charge)
        const prevAmt = prevLine.match(AMOUNT_AT_END);
        if (prevAmt) prevLine = prevLine.slice(0, prevAmt.index!).trim();
        if (prevLine && !/^\d+(\.\d{2})?$/.test(prevLine)) {
          description = prevLine;
        }
      }
    }

    if (!description) continue;
    if (/^(Total|Card\s+Number|TRANSACTION|New\s+(Standard|Payments)|PayID)/i.test(description)) continue;

    out.push({
      date: makeDate(mon, day),
      description: description.trim(),
      amount: amount.toFixed(2),
      name: currentCardholder || undefined,
    });
  }

  return out;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function parseWestpacPDF(buffer: Buffer): Promise<RawTransaction[]> {
  const lines = await extractPDFLines(buffer);
  const fullText = lines.join('\n');

  if (/American\s+Express/i.test(fullText)) {
    return parseAmexStatement(lines, fullText);
  }

  const isTransactionSearch = lines.some(
    (l) => /Transaction\s+Search/i.test(l) || ACCT_PREFIX_RE.test(l),
  );

  return isTransactionSearch ? parseTransactionSearch(lines) : parseStatementFormat(lines);
}
