import mongoose from 'mongoose';
import searchDocumentSchema from './search-document.schema.js';
import { setupSearchDocumentIndexes } from './search-document.indexes.js';

setupSearchDocumentIndexes(searchDocumentSchema);

export const SearchDocumentModel = mongoose.model('SearchDocument', searchDocumentSchema);
