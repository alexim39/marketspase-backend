// Promotion DDD bootstrap — wires domain, application, and infrastructure
export const isPromotionDddEnabled = () => process.env.PROMOTION_DDD_ENABLED === 'true';
export { Promotion, PromotionError } from './domain/entities/promotion.aggregate.js';
