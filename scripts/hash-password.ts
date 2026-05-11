import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
  console.error('Usage: npx tsx scripts/hash-password.ts <password>');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
const b64 = Buffer.from(hash).toString('base64');
console.log('Paste this into .env.local:');
console.log(`USER1_PASS_HASH=${b64}`);
