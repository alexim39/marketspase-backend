import {
  getCampaignPpcPricingConfig,
  getPublicCampaignPpcPricingConfig,
  updateCampaignPpcPricingConfig,
} from '../services/campaign-ppc-pricing-config.service.js';

const handleError = (res, error, fallbackMessage) => res.status(error.status || 500).json({
  success: false,
  message: error.message || fallbackMessage,
});

export const getCampaignPpcPricingConfigController = async (_req, res) => {
  try {
    const config = await getPublicCampaignPpcPricingConfig();
    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    handleError(res, error, 'Failed to load campaign PPC pricing configuration');
  }
};

export const getAdminCampaignPpcPricingConfigController = async (_req, res) => {
  try {
    const config = await getCampaignPpcPricingConfig({ useCache: false });
    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    handleError(res, error, 'Failed to load admin PPC pricing settings');
  }
};

export const updateAdminCampaignPpcPricingConfigController = async (req, res) => {
  try {
    const config = await updateCampaignPpcPricingConfig(req.body || {}, req.userId);
    res.status(200).json({
      success: true,
      message: 'PPC pricing settings updated',
      data: config,
    });
  } catch (error) {
    handleError(res, error, 'Failed to update admin PPC pricing settings');
  }
};
