import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, extractHashtags, extractMentions, escapeRegex } from '../src/utils/text.js';
import { deepSanitize } from '../src/utils/sanitize.js';
import { sniffMedia } from '../src/utils/fileType.js';
import { feedScore, trendScore, engagement } from '../src/utils/ranking.js';

test('cleanText strips control characters and trims', () => {
  assert.equal(cleanText('  hi\u0000 there\r\nok \u0007 '), 'hi there\nok');
});

test('hashtags: lowercased, unique, ignores numbers-only and anchors', () => {
  assert.deepEqual(extractHashtags('Love #React and #react! #123 a#b'), ['react']);
  assert.deepEqual(extractHashtags('#Tech_News is #cool'), ['tech_news', 'cool']);
});

test('mentions: ignores e-mail addresses', () => {
  assert.deepEqual(extractMentions('hi @Sarah_W and a@b.com @x'), ['sarah_w']);
});

test('escapeRegex neutralises regex metacharacters', () => {
  assert.equal(new RegExp(escapeRegex('a.b*c')).test('aXbbc'), false);
  assert.equal(new RegExp(escapeRegex('a.b*c')).test('a.b*c'), true);
});

test('deepSanitize removes Mongo operators and dotted keys', () => {
  const dirty = { email: { $ne: null }, 'a.b': 1, nested: [{ $where: 'x', ok: 1 }], fine: 'yes' };
  assert.deepEqual(deepSanitize(dirty), { email: {}, nested: [{ ok: 1 }], fine: 'yes' });
});

test('sniffMedia identifies real formats and rejects fakes', () => {
  const pad = Buffer.alloc(16);
  assert.equal(sniffMedia(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), pad])).mime, 'image/jpeg');
  assert.equal(sniffMedia(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pad])).mime, 'image/png');
  assert.equal(sniffMedia(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), pad])).mime, 'image/webp');
  assert.equal(sniffMedia(Buffer.concat([Buffer.alloc(4), Buffer.from('ftypisom'), pad])).type, 'video');
  // an HTML/SVG/script file renamed to .jpg must be rejected
  assert.equal(sniffMedia(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), null);
  assert.equal(sniffMedia(Buffer.from('MZ\u0090\u0000 executable header bytes here')), null);
  assert.equal(sniffMedia(Buffer.alloc(3)), null);
});

test('feed score favours engagement but decays with age', () => {
  const now = Date.now();
  const fresh = { likesCount: 2, createdAt: new Date(now - 36e5) };
  const old = { likesCount: 2, createdAt: new Date(now - 48 * 36e5) };
  const viralOld = { likesCount: 500, repostsCount: 100, createdAt: new Date(now - 48 * 36e5) };
  assert.ok(feedScore(fresh, now) > feedScore(old, now));
  assert.ok(feedScore(viralOld, now) > feedScore(old, now));
  assert.equal(engagement({ likesCount: 1, repostsCount: 1, repliesCount: 2, quotesCount: 1 }), 1 + 2 + 3 + 2);
});

test('trend score rewards many authors over one spammer', () => {
  const spam = trendScore({ uniqueAuthors: 1, posts: 20, engagement: 0 });
  const organic = trendScore({ uniqueAuthors: 10, posts: 10, engagement: 10 });
  assert.ok(organic > spam);
});
