// Store DDD bootstrap — wires domain, application, and infrastructure
// Feature flag: STORE_DDD_ENABLED=true to route controllers through DDD use cases

export const isStoreDddEnabled = () => process.env.STORE_DDD_ENABLED === 'true';

export { Store, Product, StoreError } from './domain/entities/commerce.aggregates.js';
