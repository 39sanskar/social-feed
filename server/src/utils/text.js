// Text helpers shared by posts, profiles and chat.

/** Removes control characters / NULs and normalises line breaks. React escapes
 *  output on the client, this keeps junk out of the database. */
export const cleanText = (s = '') =>
  String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n/g, '\n')
    .trim();

/** "#Tag" → "tag". Must start with a letter/underscore, max 10 per post. */
export const extractHashtags = (text = '') => [
  ...new Set([...text.matchAll(/(?<![\w&#])#([A-Za-z_][A-Za-z0-9_]{0,49})/g)].map((m) => m[1].toLowerCase())),
].slice(0, 10);

/** "@Name" → "name". Ignores e-mail addresses (a@b.com). */
export const extractMentions = (text = '') => [
  ...new Set([...text.matchAll(/(?<![\w@])@([A-Za-z0-9_]{3,20})/g)].map((m) => m[1].toLowerCase())),
].slice(0, 10);

/** Escapes user input before it is placed inside a RegExp. */
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
