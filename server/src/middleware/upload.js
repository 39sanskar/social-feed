import multer from 'multer';

// Files are kept in memory (never written to disk by multer) and are checked
// for their real type by services/storage.js before being stored anywhere.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 4, fields: 20, fieldSize: 10 * 1024 },
});
