const DEFAULT_COST_PER_CLICK = 80;

const getCampaignCostPerClick = (promotion) => {
  const campaign = promotion?.campaign ?? {};
  const value = Number(promotion?.costPerClick ?? campaign.costPerClick ?? campaign.payoutPerPromotion ?? DEFAULT_COST_PER_CLICK);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_COST_PER_CLICK;
};

const getCampaignRemainingBudget = (promotion) => {
  const campaign = promotion?.campaign ?? {};
  const explicitRemaining = Number(campaign.remainingBudget);

  if (Number.isFinite(explicitRemaining)) {
    return Math.max(explicitRemaining, 0);
  }

  const budget = Number(campaign.budget ?? 0);
  const spentBudget = Number(campaign.spentBudget ?? 0);
  const reservedBudget = Number(campaign.reservedBudget ?? 0);

  return Math.max(budget - spentBudget - reservedBudget, 0);
};

const formatDuration = (milliseconds) => {
  if (milliseconds <= 0) {
    return 'Expired';
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const totalHours = Math.floor(totalSeconds / 3600);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h left`;
  }

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} left`;
};

export const calculateTimeRemaining = (promotion) => {
  if (!promotion) {
    return 'Unavailable';
  }

  if (promotion.status === 'paid') {
    return 'Paid';
  }

  if (promotion.status === 'rejected') {
    return 'Closed';
  }

  if (promotion.campaign?.endDate) {
    const endDate = new Date(promotion.campaign.endDate);
    const remainingTime = endDate.getTime() - Date.now();
    return formatDuration(remainingTime);
  }

  const remainingBudget = getCampaignRemainingBudget(promotion);
  if (remainingBudget < getCampaignCostPerClick(promotion)) {
    return 'Budget Exhausted';
  }

  return 'Budget Based';
};

export const calculateProgressPercentage = (promotion) => {
  const totalClicks = Number(promotion?.clickStats?.totalClicks ?? 0);
  const billableClicks = Number(promotion?.clickStats?.billableClicks ?? 0);

  if (!totalClicks) {
    return 0;
  }

  return Math.min((billableClicks / totalClicks) * 100, 100);
};

export const calculateViewsNeeded = (promotion) => {
  const invalidClicks = Number(promotion?.clickStats?.invalidClicks ?? 0);
  const duplicateClicks = Number(promotion?.clickStats?.duplicateClicks ?? 0);
  return Math.max(invalidClicks + duplicateClicks, 0);
};

export const isNearingExpiration = (promotion) => {
  if (!promotion?.campaign?.endDate) {
    return false;
  }

  const endDate = new Date(promotion.campaign.endDate);
  const thirtyMinutesInMs = 30 * 60 * 1000;
  const timeRemaining = endDate.getTime() - Date.now();

  return timeRemaining > 0 && timeRemaining <= thirtyMinutesInMs;
};

export const isPromotionExpired = (promotion) => {
  if (promotion?.status === 'paid') {
    return false;
  }

  if (promotion?.status === 'rejected') {
    return true;
  }

  if (!promotion?.campaign?.endDate) {
    return getCampaignRemainingBudget(promotion) < getCampaignCostPerClick(promotion);
  }

  return Date.now() > new Date(promotion.campaign.endDate).getTime();
};
