// utils/slugGenerator.js
import { StoreModel } from '../models/store/store.model.js';

export async function generateUniqueStoreLink(storeName) {
  if (!storeName || typeof storeName !== 'string') {
    throw new Error('Store name is required');
  }

  // 1. Normalize to SEO-friendly slug
  const baseSlug = storeName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')     // remove special chars
    .replace(/\s+/g, '-')             // replace spaces with dash
    .replace(/-+/g, '-')              // collapse multiple dashes
    .slice(0, 50);                    // limit length for performance

  let slug = baseSlug;
  let counter = 1;

  // 2. Prevent infinite loops
  const MAX_ATTEMPTS = 50;

  while (counter <= MAX_ATTEMPTS) {
    const exists = await StoreModel.exists({ storeLink: slug });

    if (!exists) return slug;

    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  // 3. Fallback (very rare)
  return `${baseSlug}-${Date.now()}`;
}
