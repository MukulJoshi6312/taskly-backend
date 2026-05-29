import crypto from "crypto";
import bcrypt from "bcryptjs";

// Generate a 6-digit numeric code as a zero-padded string.
// Using crypto.randomInt instead of Math.random ensures the code is
// cryptographically secure (unguessable without server access).
export const generateCode = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");

// Hash the code before storing in the DB so a leaked DB doesn't reveal
// active codes. Same idea as hashing passwords.
export const hashCode = (code) => bcrypt.hash(code, 8);

// Constant-time comparison via bcrypt.compare — resistant to timing attacks.
export const compareCode = (plain, hash) => bcrypt.compare(plain, hash);

export const codeExpiry = (minutes) => new Date(Date.now() + minutes * 60 * 1000);
export const isExpired = (date) => !date || new Date() > date;
