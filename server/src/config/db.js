import mongoose from 'mongoose';
import { config } from './env.js';

export default async function connectDB() {
  mongoose.set('strictQuery', true);
  // autoIndex builds the indexes declared in the models (unique constraints,
  // feed indexes, text index). Disable on very large production databases.
  await mongoose.connect(config.mongoUri);
  console.log('MongoDB connected');
}
