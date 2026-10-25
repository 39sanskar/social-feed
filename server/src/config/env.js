// Central place for configuration. Fails fast on missing secrets so the app
// never starts in an insecure half-configured state.
import 'dotenv/config';

const e = process.env;
const isProd = e.NODE_ENV === 'production';

for (const key of ['MONGO_URI', 'JWT_SECRET']) {
  if (!e[key]) {
    console.error(`Missing required environment variable: ${key} (see .env.example)`);
    process.exit(1);
  }
}
if (isProd && e.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters in production.');
  process.exit(1);
}

const port = Number(e.PORT) || 5000;
const cloudinaryReady = Boolean(e.CLOUDINARY_CLOUD_NAME && e.CLOUDINARY_API_KEY && e.CLOUDINARY_API_SECRET);

export const config = {
  isProd,
  port,
  mongoUri: e.MONGO_URI,
  jwtSecret: e.JWT_SECRET,
  clientUrls: (e.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim()),
  publicUrl: (e.PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, ''),
  requireVerifiedEmail: e.REQUIRE_VERIFIED_EMAIL === 'true',
  storageProvider: cloudinaryReady ? 'cloudinary' : 'local',
  cloudinary: {
    cloud_name: e.CLOUDINARY_CLOUD_NAME,
    api_key: e.CLOUDINARY_API_KEY,
    api_secret: e.CLOUDINARY_API_SECRET,
  },
  mail: {
    provider: e.RESEND_API_KEY ? 'resend' : 'console',
    apiKey: e.RESEND_API_KEY,
    from: e.MAIL_FROM || 'Social-Feed <onboarding@resend.dev>',
  },
  trendingMinAuthors: Number(e.TRENDING_MIN_AUTHORS) || 2,
};
