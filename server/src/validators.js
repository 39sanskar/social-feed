// Every request body is validated with these zod schemas. Client-side checks
// are only for UX – this is the real gate.
import { z } from 'zod';
import { cleanText } from './utils/text.js';

const id = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
// cleans the text, then (optionally) requires something to be left after trimming
const text = (max, min = 0) =>
  z.string().max(max, `Maximum ${max} characters`).transform(cleanText).refine((v) => v.length >= min, 'This cannot be empty');
// multipart/form-data sends every value as a string
const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

export const username = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/, 'Username: 3–20 letters, numbers or underscores');
const password = z.string().min(8, 'Password needs at least 8 characters').max(100);

export const registerSchema = z.object({
  username,
  displayName: text(50).optional(),
  email: z.string().trim().toLowerCase().email('Enter a valid e-mail').max(120),
  password,
});
export const loginSchema = z.object({ login: z.string().trim().toLowerCase().min(1).max(120), password: z.string().min(1).max(100) });
export const emailSchema = z.object({ email: z.string().trim().toLowerCase().email().max(120) });
export const tokenSchema = z.object({ token: z.string().min(20).max(200) });
export const resetSchema = z.object({ token: z.string().min(20).max(200), password });
export const changePasswordSchema = z.object({ current: z.string().min(1).max(100), password });
export const passwordOnlySchema = z.object({ password: z.string().min(1).max(100) });

export const profileSchema = z.object({
  username: username.optional(),
  displayName: text(50).optional(),
  bio: text(160).optional(),
  location: text(40).optional(),
  website: z.union([z.literal(''), z.string().trim().max(100).url('Website must be a full URL, e.g. https://example.com').refine((u) => /^https?:\/\//i.test(u), 'Only http(s) links are allowed')]).optional(),
});
export const settingsSchema = z.object({
  allowDMsFrom: z.enum(['everyone', 'following']).optional(),
  notifications: z.object({ like: z.boolean(), reply: z.boolean(), repost: z.boolean(), follow: z.boolean(), mention: z.boolean() }).partial().optional(),
});
export const mutedWordsSchema = z.object({ words: z.array(z.string().trim().min(1).max(40)).max(50) });

export const createPostSchema = z.object({
  text: text(500).optional().default(''),
  parent: id.optional(),
  quoteOf: id.optional(),
  sensitive: bool.optional().default('false'),
});
export const editPostSchema = z.object({ text: text(500, 1), sensitive: z.boolean().optional() });

export const listSchema = z.object({ name: z.string().trim().min(1, 'Give the list a name').max(50), description: text(160).optional().default('') });
export const memberSchema = z.object({ userId: id });

export const createConversationSchema = z.object({ userIds: z.array(id).min(1).max(19), name: text(60).optional() });
export const sendMessageSchema = z.object({ text: text(1000).optional().default('') });
export const editMessageSchema = z.object({ text: text(1000, 1) });

export const reportSchema = z.object({
  targetType: z.enum(['post', 'user', 'message']),
  target: id,
  reason: z.enum(['spam', 'abuse', 'harassment', 'violence', 'sensitive', 'other']),
  details: text(500).optional().default(''),
});
