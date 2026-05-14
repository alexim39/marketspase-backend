import { getAdminTransactions } from '../services/financial-analytics.service.js';

export const getTransactions = async (req, res) => {
  try {
    const data = await getAdminTransactions(req.query || {});

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error getting transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions',
    });
  }
};
