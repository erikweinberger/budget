import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET!;
const COOKIE_NAME = 'budget_token';

export interface JWTPayload {
  userId: number;
  username: string;
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export interface HardcodedUser {
  id: number;
  username: string;
  passwordHash: string;
}

function decodeHash(b64: string | undefined): string {
  if (!b64) return '';
  return Buffer.from(b64, 'base64').toString('utf-8');
}

export function getHardcodedUsers(): HardcodedUser[] {
  return [
    {
      id: 1,
      username: process.env.USER1_NAME!,
      passwordHash: decodeHash(process.env.USER1_PASS_HASH),
    },
    {
      id: 2,
      username: process.env.USER2_NAME!,
      passwordHash: decodeHash(process.env.USER2_PASS_HASH),
    },
  ].filter((u) => u.username && u.passwordHash);
}

export { COOKIE_NAME };
