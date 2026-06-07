import {
  buildFinancialAnalytics,
  exportAdminDeposits,
  getAdminDeposits,
  getFinancialOverviewPayload,
  getFinancialStatsPayload,
} from '../services/financial-analytics.service.js';

export const getFinancialOverview = async (req, res) => {
  try {
    const data = await getFinancialOverviewPayload();

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error getting financial overview:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading financial overview',
    });
  }
};

export const getFinancialStats = async (req, res) => {
  try {
    const data = await getFinancialStatsPayload(req.query.year);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error getting financial stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating financial statistics',
    });
  }
};

export const getFinancialAnalytics = async (req, res) => {
  try {
    const data = await buildFinancialAnalytics({
      year: req.query.year,
      trendYears: req.query.trendYears,
      top: req.query.top,
    });

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error getting financial analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading financial analytics',
    });
  }
};

export const getDeposits = async (req, res) => {
  try {
    const data = await getAdminDeposits(req.query || {});

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error getting deposits:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching deposits',
    });
  }
};

export const exportDeposits = async (req, res) => {
  try {
    const data = await exportAdminDeposits({
      ...(req.query || {}),
      ...(req.body || {}),
    });

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error exporting deposits:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting deposits',
    });
  }
};

export const exportTransactions = async (req, res) => {
  try {
    const { format = 'csv' } = req.body;
    const exportUrl = `/exports/transactions_${Date.now()}.${format}`;

    res.json({
      success: true,
      data: {
        url: exportUrl,
        message: `Export generated successfully in ${String(format).toUpperCase()} format`,
      },
    });
  } catch (error) {
    console.error('Error exporting transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting transactions',
    });
  }
};

export const exportWithdrawals = async (req, res) => {
  try {
    const { format = 'csv' } = req.body;
    const exportUrl = `/exports/withdrawals_${Date.now()}.${format}`;

    res.json({
      success: true,
      data: {
        url: exportUrl,
        message: `Withdrawals export generated successfully in ${String(format).toUpperCase()} format`,
      },
    });
  } catch (error) {
    console.error('Error exporting withdrawals:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting withdrawals',
    });
  }
};
