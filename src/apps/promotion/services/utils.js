

export const calculateTimeRemaining = (promotion) => {
  const createdAt = new Date(promotion.createdAt);
  const expirationTime = createdAt.getTime() + (24 * 60 * 60 * 1000);
  const timeRemaining = expirationTime - Date.now();
  
  if (timeRemaining <= 0) return 'Expired';
  
  const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};


export const calculateProgressPercentage = (promotion) => {
  const minViews = promotion.campaign?.minViewsPerPromotion || 25;
  const currentViews = promotion.proofViews || 0;
  return Math.min((currentViews / minViews) * 100, 100);
};


export const calculateViewsNeeded = (promotion) => {
  const minViews = promotion.campaign?.minViewsPerPromotion || 25;
  const currentViews = promotion.proofViews || 0;
  return Math.max(minViews - currentViews, 0);
};


export const isNearingExpiration = (promotion) => {
  const createdAt = new Date(promotion.createdAt);
  const expirationTime = createdAt.getTime() + (24 * 60 * 60 * 1000);
  const thirtyMinutesInMs = 30 * 60 * 1000;
  const timeRemaining = expirationTime - Date.now();
  
  return timeRemaining > 0 && timeRemaining <= thirtyMinutesInMs;
};


// Helper functions
export const isPromotionExpired = (promotion) => {
  const createdAt = new Date(promotion.createdAt);
  const expirationTime = createdAt.getTime() + (24 * 60 * 60 * 1000);
  return Date.now() > expirationTime;
};