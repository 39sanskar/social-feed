// Media storage behind one function so the provider can be swapped without
// touching any route. Cloudinary (free tier) in production; local disk fallback
// for development when Cloudinary keys are not configured.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/env.js';
import { sniffMedia } from '../utils/fileType.js';
import { AppError } from '../middleware/error.js';

export const UPLOAD_DIR = path.resolve('uploads');
if (config.storageProvider === 'cloudinary') cloudinary.config(config.cloudinary);

const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_VIDEO = 25 * 1024 * 1024;

/** Validates (real type + size) and stores ONE multer file. Returns { url, type }. */
async function saveOne(file, folder, { imagesOnly }) {
  const kind = sniffMedia(file.buffer); // trust the bytes, not the filename or Content-Type
  if (!kind) throw new AppError(400, 'Unsupported file. Use JPG, PNG, GIF, WebP, MP4 or WebM.');
  if (imagesOnly && kind.type !== 'image') throw new AppError(400, 'Only images are allowed here');
  if (file.size > (kind.type === 'image' ? MAX_IMAGE : MAX_VIDEO))
    throw new AppError(413, kind.type === 'image' ? 'Images can be up to 8 MB' : 'Videos can be up to 25 MB');

  if (config.storageProvider === 'cloudinary') {
    const url = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder, resource_type: kind.type }, (err, r) => (err ? reject(err) : resolve(r.secure_url)));
      stream.end(file.buffer);
    });
    return { url, type: kind.type };
  }
  // Local fallback: the file name is random and the extension comes from the
  // sniffed type, so user-controlled names can never cause path traversal.
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${crypto.randomUUID()}.${kind.ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), file.buffer);
  return { url: `${config.publicUrl}/uploads/${name}`, type: kind.type };
}

export const saveMedia = (files = [], folder, opts = {}) => Promise.all(files.map((f) => saveOne(f, folder, opts)));
