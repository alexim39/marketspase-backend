// utils/slugGenerator.js
import { StoreModel } from '../models/store/index.js';

export async function generateUniqueStoreSlug(name) {
  // Create base slug
  let slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);

  // Check if slug exists
  let existingStore = await StoreModel.findOne({ slug });
  let counter = 1;
  const originalSlug = slug;

  // Add incremental number if slug exists
  while (existingStore) {
    slug = `${originalSlug}-${counter}`;
    existingStore = await StoreModel.findOne({ slug });
    counter++;
  }

  return slug;
}