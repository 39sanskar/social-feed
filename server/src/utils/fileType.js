// Detects the REAL type of an upload from its first bytes ("magic numbers").
// Browsers send the Content-Type header, but attackers can set it to anything,
// so we never trust it (or the filename) to decide what a file is.

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MP4_BRANDS = ['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V ', 'qt  '];

export function sniffMedia(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: 'image', mime: 'image/jpeg', ext: 'jpg' };
  if (buf.subarray(0, 8).equals(PNG)) return { type: 'image', mime: 'image/png', ext: 'png' };
  const head = buf.subarray(0, 6).toString('ascii');
  if (head === 'GIF87a' || head === 'GIF89a') return { type: 'image', mime: 'image/gif', ext: 'gif' };
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP')
    return { type: 'image', mime: 'image/webp', ext: 'webp' };
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp' && MP4_BRANDS.includes(buf.subarray(8, 12).toString('ascii')))
    return { type: 'video', mime: 'video/mp4', ext: 'mp4' };
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3)
    return { type: 'video', mime: 'video/webm', ext: 'webm' };
  return null; // SVG, HTML, executables, etc. are all rejected
}
