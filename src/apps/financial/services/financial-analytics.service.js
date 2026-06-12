import { UserModel } from '../../user/models/user/index.js';
import { OrderModel } from '../../store/models/order/order.model.js';

const DEFAULT_BASE_CURRENCY = 'NGN';
const SUCCESS_STATUSES = ['successful', 'completed', 'paid'];
const PROMOTER_PAYOUT_CATEGORIES = ['promotion', 'commission', 'store_promotion'];
const PLATFORM_REVENUE_CATEGORIES = ['fee', 'ai_subscription'];
const CASH_INFLOW_CATEGORIES = ['deposit'];
const CASH_OUTFLOW_CATEGORIES = ['withdrawal', 'refund'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CATEGORY_LABELS = {
  deposit: 'Wallet funding',
  withdrawal: 'Withdrawals',
  campaign: 'Campaign spend',
  promotion: 'Promotion payouts',
  bonus: 'Bonuses',
  fee: 'Platform fees',
  refund: 'Refunds',
  transfer: 'Transfers',
  commission: 'Affiliate commissions',
  reserved_credit: 'Reserved credits',
  credit: 'Credits',
  completed: 'Completed settlements',
  store_verification: 'Store verification',
  store_sale: 'Store sales settlement',
  store_promotion: 'Store promotion payouts',
  reversal: 'Reversals',
  birthday_bonus: 'Birthday bonuses',
  balance_recalculation: 'Balance recalculation',
  promoter_balance_reset: 'Promoter balance reset',
  negative_reserved_fix: 'Negative reserved fix',
  ai_subscription: 'AI subscriptions',
  storefront_sales: 'Storefront sales',
};

const STATUS_LABELS = {
  initiated: 'Initiated',
  pending: 'Pending',
  processing: 'Processing',
  successful: 'Successful',
  failed: 'Failed',
  refunded: 'Refunded',
  reversed: 'Reversed',
  cancelled: 'Cancelled',
  abandoned: 'Abandoned',
  reserved: 'Reserved',
  approved: 'Approved',
  declined: 'Declined',
  completed: 'Completed',
  paid: 'Paid',
  reserved_to_promoter: 'Reserved to promoter',
  rejected: 'Rejected',
  pending_approval: 'Pending approval',
};

const normalizeNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const roundAmount = (value) => Math.round((normalizeNumber(value) + Number.EPSILON) * 100) / 100;

const toShare = (value, total) => {
  if (!total) return 0;
  return roundAmount((normalizeNumber(value) / normalizeNumber(total)) * 100);
};

const getSelectedYear = (rawYear) => {
  const currentYear = new Date().getUTCFullYear();
  const parsedYear = Number(rawYear);

  if (!Number.isInteger(parsedYear) || parsedYear < 2020 || parsedYear > currentYear + 1) {
    return currentYear;
  }

  return parsedYear;
};

const getTrendYears = (rawValue) => {
  const parsedValue = Number(rawValue);
  if (!Number.isInteger(parsedValue)) {
    return 5;
  }
  return Math.max(3, Math.min(8, parsedValue));
};

const getTopRows = (rawValue) => {
  const parsedValue = Number(rawValue);
  if (!Number.isInteger(parsedValue)) {
    return 8;
  }
  return Math.max(4, Math.min(16, parsedValue));
};

const getPageNumber = (rawPage) => Math.max(1, Number.parseInt(rawPage, 10) || 1);
const getPageSize = (rawLimit, fallback = 20, max = 200) => Math.max(1, Math.min(max, Number.parseInt(rawLimit, 10) || fallback));
const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getValidDate = (rawValue) => {
  if (!rawValue) {
    return null;
  }

  const date = new Date(rawValue);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getInclusiveEndDate = (rawValue) => {
  const date = getValidDate(rawValue);
  if (!date) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(rawValue))) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return date;
};

const getYearStart = (year) => new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
const getYearEnd = (year) => new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));

const getCreatedAtMatchStage = (startDate, endDate) => {
  const createdAt = {};

  if (startDate) {
    createdAt.$gte = startDate;
  }

  if (endDate) {
    createdAt.$lt = endDate;
  }

  return Object.keys(createdAt).length > 0
    ? { $match: { createdAt: createdAt } }
    : null;
};

const buildWalletTransactionStages = ({ startDate = null, endDate = null } = {}) => {
  const stages = [
    {
      $project: {
        transactions: {
          $concatArrays: [
            {
              $map: {
                input: { $ifNull: ['$wallets.marketer.transactions', []] },
                as: 'txn',
                in: {
                  transactionId: '$$txn._id',
                  userId: '$_id',
                  userName: '$displayName',
                  userEmail: '$email',
                  userRole: '$role',
                  walletType: 'marketer',
                  type: '$$txn.type',
                  category: '$$txn.category',
                  status: '$$txn.status',
                  createdAt: '$$txn.createdAt',
                  processedAt: '$$txn.processedAt',
                  amount: { $ifNull: ['$$txn.baseAmount', '$$txn.amount'] },
                  nativeAmount: { $ifNull: ['$$txn.amount', 0] },
                  amountPayable: { $ifNull: ['$$txn.amountPayable', 0] },
                  fee: { $ifNull: ['$$txn.fee', 0] },
                  settlementAmount: { $ifNull: ['$$txn.settlementAmount', null] },
                  exchangeRate: { $ifNull: ['$$txn.exchangeRate', null] },
                  gateway: { $ifNull: ['$$txn.gateway', 'system'] },
                  currency: { $ifNull: ['$$txn.currency', DEFAULT_BASE_CURRENCY] },
                  baseCurrency: { $ifNull: ['$$txn.baseCurrency', DEFAULT_BASE_CURRENCY] },
                  settlementCurrency: {
                    $ifNull: ['$$txn.settlementCurrency', { $ifNull: ['$$txn.currency', DEFAULT_BASE_CURRENCY] }]
                  },
                  reference: { $ifNull: ['$$txn.reference', ''] },
                  description: { $ifNull: ['$$txn.description', ''] },
                  bankDetails: { $ifNull: ['$$txn.bankDetails', null] },
                  transferCode: { $ifNull: ['$$txn.transferCode', null] },
                  failureReason: { $ifNull: ['$$txn.failureReason', null] },
                  meta: { $ifNull: ['$$txn.meta', {}] },
                },
              },
            },
            {
              $map: {
                input: { $ifNull: ['$wallets.promoter.transactions', []] },
                as: 'txn',
                in: {
                  transactionId: '$$txn._id',
                  userId: '$_id',
                  userName: '$displayName',
                  userEmail: '$email',
                  userRole: '$role',
                  walletType: 'promoter',
                  type: '$$txn.type',
                  category: '$$txn.category',
                  status: '$$txn.status',
                  createdAt: '$$txn.createdAt',
                  processedAt: '$$txn.processedAt',
                  amount: { $ifNull: ['$$txn.baseAmount', '$$txn.amount'] },
                  nativeAmount: { $ifNull: ['$$txn.amount', 0] },
                  amountPayable: { $ifNull: ['$$txn.amountPayable', 0] },
                  fee: { $ifNull: ['$$txn.fee', 0] },
                  settlementAmount: { $ifNull: ['$$txn.settlementAmount', null] },
                  exchangeRate: { $ifNull: ['$$txn.exchangeRate', null] },
                  gateway: { $ifNull: ['$$txn.gateway', 'system'] },
                  currency: { $ifNull: ['$$txn.currency', DEFAULT_BASE_CURRENCY] },
                  baseCurrency: { $ifNull: ['$$txn.baseCurrency', DEFAULT_BASE_CURRENCY] },
                  settlementCurrency: {
                    $ifNull: ['$$txn.settlementCurrency', { $ifNull: ['$$txn.currency', DEFAULT_BASE_CURRENCY] }]
                  },
                  reference: { $ifNull: ['$$txn.reference', ''] },
                  description: { $ifNull: ['$$txn.description', ''] },
                  bankDetails: { $ifNull: ['$$txn.bankDetails', null] },
                  transferCode: { $ifNull: ['$$txn.transferCode', null] },
                  failureReason: { $ifNull: ['$$txn.failureReason', null] },
                  meta: { $ifNull: ['$$txn.meta', {}] },
                },
              },
            },
          ],
        },
      },
    },
    { $unwind: '$transactions' },
    { $replaceRoot: { newRoot: '$transactions' } },
  ];

  const createdAtMatch = getCreatedAtMatchStage(startDate, endDate);
  if (createdAtMatch) {
    stages.push(createdAtMatch);
  }

  return stages;
};

const aggregateTransactions = async (pipeline) => UserModel
  .aggregate(pipeline)
  .option({ allowDiskUse: true });

const buildBreakdownItems = (rows, totalAmount, topRows) => rows
  .sort((left, right) => right.amount - left.amount)
  .slice(0, topRows)
  .map((row) => ({
    key: row.key,
    label: row.label,
    amount: roundAmount(row.amount),
    count: normalizeNumber(row.count),
    share: toShare(row.amount, totalAmount),
  }));

const buildWithdrawalState = (rows) => {
  const byStatus = new Map(rows.map((row) => [row.status, row]));
  const pendingApproval = byStatus.get('pending_approval') || { count: 0, amount: 0 };
  const processing = byStatus.get('processing') || { count: 0, amount: 0 };
  const successful = byStatus.get('successful') || { count: 0, amount: 0 };
  const approved = byStatus.get('approved') || { count: 0, amount: 0 };
  const failed = byStatus.get('failed') || { count: 0, amount: 0 };
  const rejected = byStatus.get('rejected') || { count: 0, amount: 0 };
  const reversed = byStatus.get('reversed') || { count: 0, amount: 0 };
  const pending = byStatus.get('pending') || { count: 0, amount: 0 };

  return {
    totalCount: rows.reduce((sum, row) => sum + normalizeNumber(row.count), 0),
    totalAmount: rows.reduce((sum, row) => sum + normalizeNumber(row.amount), 0),
    pendingApprovalCount: normalizeNumber(pendingApproval.count),
    pendingApprovalAmount: roundAmount(pendingApproval.amount),
    processingCount: normalizeNumber(processing.count),
    processingAmount: roundAmount(processing.amount),
    successfulCount: normalizeNumber(successful.count),
    successfulAmount: roundAmount(successful.amount),
    approvedCount: normalizeNumber(approved.count),
    approvedAmount: roundAmount(approved.amount),
    failedCount: normalizeNumber(failed.count),
    failedAmount: roundAmount(failed.amount),
    rejectedCount: normalizeNumber(rejected.count),
    rejectedAmount: roundAmount(rejected.amount),
    reversedCount: normalizeNumber(reversed.count),
    reversedAmount: roundAmount(reversed.amount),
    pendingCount: normalizeNumber(pending.count),
    pendingAmount: roundAmount(pending.amount),
  };
};

const getWalletExposureSummary = async () => {
  const users = await UserModel.find(
    {},
    {
      role: 1,
      'wallets.marketer.balance': 1,
      'wallets.marketer.reserved': 1,
      'wallets.marketer.balancesByCurrency': 1,
      'wallets.marketer.reservedByCurrency': 1,
      'wallets.promoter.balance': 1,
      'wallets.promoter.reserved': 1,
      'wallets.promoter.balancesByCurrency': 1,
      'wallets.promoter.reservedByCurrency': 1,
    },
  ).lean();

  const exposure = {
    totalAvailable: 0,
    totalReserved: 0,
    marketerAvailable: 0,
    marketerReserved: 0,
    promoterAvailable: 0,
    promoterReserved: 0,
    balancesByCurrency: {},
    reservedByCurrency: {},
  };

  const toEntries = (mapLike = {}) => {
    if (!mapLike) {
      return [];
    }

    if (mapLike instanceof Map || typeof mapLike?.entries === 'function') {
      return Array.from(mapLike.entries());
    }

    return Object.entries(mapLike);
  };

  const mergeCurrencyMap = (target, mapLike = {}) => {
    const entries = toEntries(mapLike);
    if (entries.length === 0) {
      return;
    }

    for (const [currency, amount] of entries) {
      const normalizedCurrency = currency || DEFAULT_BASE_CURRENCY;
      target[normalizedCurrency] = roundAmount(
        normalizeNumber(target[normalizedCurrency]) + normalizeNumber(amount),
      );
    }
  };

  const buildNormalizedWalletMap = (wallet, bucket = 'balance') => {
    const baseCurrency = wallet?.baseCurrency || wallet?.currency || DEFAULT_BASE_CURRENCY;
    const scalarAmount = bucket === 'reserved'
      ? normalizeNumber(wallet?.reserved)
      : normalizeNumber(wallet?.balance);
    const rawMap = bucket === 'reserved'
      ? wallet?.reservedByCurrency
      : wallet?.balancesByCurrency;
    const normalizedMap = Object.fromEntries(toEntries(rawMap));

    normalizedMap[baseCurrency] = roundAmount(scalarAmount);
    return normalizedMap;
  };

  for (const user of users) {
    const marketerWallet = user.wallets?.marketer || {};
    const promoterWallet = user.wallets?.promoter || {};

    exposure.marketerAvailable += normalizeNumber(marketerWallet.balance);
    exposure.marketerReserved += normalizeNumber(marketerWallet.reserved);
    exposure.promoterAvailable += normalizeNumber(promoterWallet.balance);
    exposure.promoterReserved += normalizeNumber(promoterWallet.reserved);

    mergeCurrencyMap(exposure.balancesByCurrency, buildNormalizedWalletMap(marketerWallet, 'balance'));
    mergeCurrencyMap(exposure.balancesByCurrency, buildNormalizedWalletMap(promoterWallet, 'balance'));
    mergeCurrencyMap(exposure.reservedByCurrency, buildNormalizedWalletMap(marketerWallet, 'reserved'));
    mergeCurrencyMap(exposure.reservedByCurrency, buildNormalizedWalletMap(promoterWallet, 'reserved'));
  }

  exposure.totalAvailable = roundAmount(exposure.marketerAvailable + exposure.promoterAvailable);
  exposure.totalReserved = roundAmount(exposure.marketerReserved + exposure.promoterReserved);
  exposure.marketerAvailable = roundAmount(exposure.marketerAvailable);
  exposure.marketerReserved = roundAmount(exposure.marketerReserved);
  exposure.promoterAvailable = roundAmount(exposure.promoterAvailable);
  exposure.promoterReserved = roundAmount(exposure.promoterReserved);

  return exposure;
};

const getRecentTransactions = async (limit = 10) => {
  const rows = await aggregateTransactions([
    ...buildWalletTransactionStages(),
    { $sort: { createdAt: -1 } },
    { $limit: limit },
  ]);

  return rows.map((row) => ({
    id: row.transactionId?.toString?.() || '',
    userId: row.userId?.toString?.() || '',
    userName: row.userName || 'Unknown user',
    userRole: row.walletType || row.userRole || 'marketer',
    type: row.type,
    category: row.category,
    amount: roundAmount(row.amount),
    amountPayable: roundAmount(row.amountPayable),
    fee: roundAmount(row.fee),
    currency: row.currency || DEFAULT_BASE_CURRENCY,
    baseCurrency: row.baseCurrency || DEFAULT_BASE_CURRENCY,
    status: row.status,
    description: row.description || CATEGORY_LABELS[row.category] || 'Wallet transaction',
    createdAt: row.createdAt,
    processedAt: row.processedAt || null,
    reference: row.reference || '',
    transferCode: row.transferCode || null,
    failureReason: row.failureReason || null,
    bankDetails: row.bankDetails || null,
  }));
};

const getWithdrawalQueue = async (status, limit = 5) => {
  const rows = await aggregateTransactions([
    ...buildWalletTransactionStages(),
    {
      $match: {
        category: 'withdrawal',
        status: status,
      },
    },
    { $sort: { createdAt: -1 } },
    { $limit: limit },
  ]);

  return rows.map((row) => ({
    withdrawalId: row.transactionId?.toString?.() || '',
    userId: row.userId?.toString?.() || '',
    userName: row.userName || 'Unknown user',
    userEmail: row.userEmail || '',
    userRole: row.userRole || row.walletType || 'marketer',
    amount: roundAmount(row.amount),
    amountPayable: roundAmount(row.amountPayable),
    fee: roundAmount(row.fee),
    bankName: row.bankDetails?.bank || 'N/A',
    bankCode: row.bankDetails?.bankCode || '',
    accountNumber: row.bankDetails?.accountNumber || '',
    accountName: row.bankDetails?.accountName || '',
    status: row.status,
    createdAt: row.createdAt,
    processedAt: row.processedAt || null,
    walletType: row.walletType || 'marketer',
    reference: row.reference || '',
    transferCode: row.transferCode || null,
    failureReason: row.failureReason || null,
  }));
};

export const buildFinancialAnalytics = async ({
  year: rawYear,
  trendYears: rawTrendYears,
  top: rawTopRows,
} = {}) => {
  const year = getSelectedYear(rawYear);
  const trendYears = getTrendYears(rawTrendYears);
  const topRows = getTopRows(rawTopRows);
  const yearStart = getYearStart(year);
  const yearEnd = getYearEnd(year);
  const trendStart = getYearStart(year - trendYears + 1);
  const baseCurrency = DEFAULT_BASE_CURRENCY;

  const summaryRowsPromise = aggregateTransactions([
    ...buildWalletTransactionStages({ startDate: yearStart, endDate: yearEnd }),
    {
      $group: {
        _id: null,
        totalTransactions: { $sum: 1 },
        successfulTransactions: {
          $sum: {
            $cond: [{ $in: ['$status', SUCCESS_STATUSES] }, 1, 0],
          },
        },
        walletFunding: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ['$status', SUCCESS_STATUSES] },
                  { $in: ['$category', CASH_INFLOW_CATEGORIES] },
                ],
              },
              '$amount',
              0,
            ],
          },
        },
        platformRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ['$status', SUCCESS_STATUSES] },
                  { $in: ['$category', PLATFORM_REVENUE_CATEGORIES] },
                ],
              },
              '$amount',
              0,
            ],
          },
        },
        campaignSpend: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ['$status', SUCCESS_STATUSES] },
                  { $eq: ['$category', 'campaign'] },
                  { $eq: ['$type', 'debit'] },
                ],
              },
              '$amount',
              0,
            ],
          },
        },
        promoterPayouts: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ['$status', SUCCESS_STATUSES] },
                  { $in: ['$category', PROMOTER_PAYOUT_CATEGORIES] },
                  { $eq: ['$type', 'credit'] },
                ],
              },
              '$amount',
              0,
            ],
          },
        },
        successfulWithdrawals: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ['$status', SUCCESS_STATUSES] },
                  { $eq: ['$category', 'withdrawal'] },
                ],
              },
              '$amount',
              0,
            ],
          },
        },
        walletRefunds: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ['$status', SUCCESS_STATUSES] },
                  { $eq: ['$category', 'refund'] },
                ],
              },
              '$amount',
              0,
            ],
          },
        },
      },
    },
  ]);

  const monthlyTransactionRowsPromise = aggregateTransactions([
    ...buildWalletTransactionStages({ startDate: yearStart, endDate: yearEnd }),
    {
      $group: {
        _id: { $month: '$createdAt' },
        walletFunding: {
          $sum: {
            $cond: [
              { $and: [{ $in: ['$status', SUCCESS_STATUSES] }, { $in: ['$category', CASH_INFLOW_CATEGORIES] }] },
              '$amount',
              0,
            ],
          },
        },
        platformRevenue: {
          $sum: {
            $cond: [
              { $and: [{ $in: ['$status', SUCCESS_STATUSES] }, { $in: ['$category', PLATFORM_REVENUE_CATEGORIES] }] },
              '$amount',
              0,
            ],
          },
        },
        campaignSpend: {
          $sum: {
            $cond: [
              { $and: [{ $in: ['$status', SUCCESS_STATUSES] }, { $eq: ['$category', 'campaign'] }, { $eq: ['$type', 'debit'] }] },
              '$amount',
              0,
            ],
          },
        },
        promoterPayouts: {
          $sum: {
            $cond: [
              { $and: [{ $in: ['$status', SUCCESS_STATUSES] }, { $in: ['$category', PROMOTER_PAYOUT_CATEGORIES] }, { $eq: ['$type', 'credit'] }] },
              '$amount',
              0,
            ],
          },
        },
        cashOut: {
          $sum: {
            $cond: [
              { $and: [{ $in: ['$status', SUCCESS_STATUSES] }, { $in: ['$category', CASH_OUTFLOW_CATEGORIES] }] },
              '$amount',
              0,
            ],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const yearlyTransactionRowsPromise = aggregateTransactions([
    ...buildWalletTransactionStages({ startDate: trendStart, endDate: yearEnd }),
    {
      $group: {
        _id: { $year: '$createdAt' },
        walletFunding: {
          $sum: {
            $cond: [
              { $and: [{ $in: ['$status', SUCCESS_STATUSES] }, { $in: ['$category', CASH_INFLOW_CATEGORIES] }] },
              '$amount',
              0,
            ],
          },
        },
        platformRevenue: {
          $sum: {
            $cond: [
              { $and: [{ $in: ['$status', SUCCESS_STATUSES] }, { $in: ['$category', PLATFORM_REVENUE_CATEGORIES] }] },
              '$amount',
              0,
            ],
          },
        },
        cashOut: {
          $sum: {
            $cond: [
              { $and: [{ $in: ['$status', SUCCESS_STATUSES] }, { $in: ['$category', CASH_OUTFLOW_CATEGORIES] }] },
              '$amount',
              0,
            ],
          },
        },
        campaignSpend: {
          $sum: {
            $cond: [
              { $and: [{ $in: ['$status', SUCCESS_STATUSES] }, { $eq: ['$category', 'campaign'] }, { $eq: ['$type', 'debit'] }] },
              '$amount',
              0,
            ],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const transactionCategoryRowsPromise = aggregateTransactions([
    ...buildWalletTransactionStages({ startDate: yearStart, endDate: yearEnd }),
    { $match: { status: { $in: SUCCESS_STATUSES } } },
    {
      $group: {
        _id: '$category',
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  const withdrawalStatusRowsPromise = aggregateTransactions([
    ...buildWalletTransactionStages({ startDate: yearStart, endDate: yearEnd }),
    { $match: { category: 'withdrawal' } },
    {
      $group: {
        _id: '$status',
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  const transactionStatusRowsPromise = aggregateTransactions([
    ...buildWalletTransactionStages({ startDate: yearStart, endDate: yearEnd }),
    {
      $group: {
        _id: '$status',
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  const transactionCurrencyRowsPromise = aggregateTransactions([
    ...buildWalletTransactionStages({ startDate: yearStart, endDate: yearEnd }),
    { $match: { status: { $in: SUCCESS_STATUSES } } },
    {
      $group: {
        _id: '$currency',
        amount: { $sum: '$amount' },
        nativeAmount: { $sum: '$nativeAmount' },
        count: { $sum: 1 },
      },
    },
  ]);

  const orderSummaryPromise = OrderModel.aggregate([
    {
      $match: {
        isDeleted: { $ne: true },
        placedAt: { $gte: yearStart, $lt: yearEnd },
      },
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        paidOrders: {
          $sum: {
            $cond: [{ $in: ['$paymentStatus', ['paid', 'partially_refunded', 'refunded']] }, 1, 0],
          },
        },
        paidOrderVolume: {
          $sum: {
            $cond: [{ $in: ['$paymentStatus', ['paid', 'partially_refunded', 'refunded']] }, '$totalAmount', 0],
          },
        },
        refundedOrders: {
          $sum: {
            $cond: [{ $in: ['$paymentStatus', ['refunded', 'partially_refunded']] }, 1, 0],
          },
        },
        refundedVolume: {
          $sum: {
            $cond: [{ $eq: ['$paymentStatus', 'refunded'] }, '$totalAmount', 0],
          },
        },
        heldEscrow: {
          $sum: {
            $cond: [
              { $eq: ['$escrowStatus', 'held'] },
              { $add: [{ $ifNull: ['$marketerReservedAmount', 0] }, { $ifNull: ['$promoterReservedAmount', 0] }] },
              0,
            ],
          },
        },
        releasedEscrow: {
          $sum: {
            $cond: [
              { $eq: ['$escrowStatus', 'released'] },
              { $add: [{ $ifNull: ['$marketerReservedAmount', 0] }, { $ifNull: ['$promoterReservedAmount', 0] }] },
              0,
            ],
          },
        },
        totalPromoterCommission: { $sum: { $ifNull: ['$totalPromoterCommission', 0] } },
        guestOrders: {
          $sum: { $cond: [{ $eq: ['$customerType', 'guest'] }, 1, 0] },
        },
        registeredOrders: {
          $sum: { $cond: [{ $eq: ['$customerType', 'registered'] }, 1, 0] },
        },
        marketerReserved: { $sum: { $ifNull: ['$marketerReservedAmount', 0] } },
        promoterReserved: { $sum: { $ifNull: ['$promoterReservedAmount', 0] } },
      },
    },
  ]);

  const monthlyOrderRowsPromise = OrderModel.aggregate([
    {
      $match: {
        isDeleted: { $ne: true },
        placedAt: { $gte: yearStart, $lt: yearEnd },
      },
    },
    {
      $group: {
        _id: { $month: '$placedAt' },
        paidOrderVolume: {
          $sum: {
            $cond: [{ $in: ['$paymentStatus', ['paid', 'partially_refunded', 'refunded']] }, '$totalAmount', 0],
          },
        },
        paidOrders: {
          $sum: {
            $cond: [{ $in: ['$paymentStatus', ['paid', 'partially_refunded', 'refunded']] }, 1, 0],
          },
        },
        refundedVolume: {
          $sum: {
            $cond: [{ $eq: ['$paymentStatus', 'refunded'] }, '$totalAmount', 0],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const yearlyOrderRowsPromise = OrderModel.aggregate([
    {
      $match: {
        isDeleted: { $ne: true },
        placedAt: { $gte: trendStart, $lt: yearEnd },
      },
    },
    {
      $group: {
        _id: { $year: '$placedAt' },
        paidOrderVolume: {
          $sum: {
            $cond: [{ $in: ['$paymentStatus', ['paid', 'partially_refunded', 'refunded']] }, '$totalAmount', 0],
          },
        },
        paidOrders: {
          $sum: {
            $cond: [{ $in: ['$paymentStatus', ['paid', 'partially_refunded', 'refunded']] }, 1, 0],
          },
        },
        refundedVolume: {
          $sum: {
            $cond: [{ $eq: ['$paymentStatus', 'refunded'] }, '$totalAmount', 0],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const orderCurrencyRowsPromise = OrderModel.aggregate([
    {
      $match: {
        isDeleted: { $ne: true },
        placedAt: { $gte: yearStart, $lt: yearEnd },
        paymentStatus: { $in: ['paid', 'partially_refunded', 'refunded'] },
      },
    },
    {
      $group: {
        _id: '$checkoutCurrency',
        amount: { $sum: '$totalAmount' },
        nativeAmount: { $sum: { $ifNull: ['$checkoutTotalAmount', '$totalAmount'] } },
        count: { $sum: 1 },
      },
    },
  ]);

  const [
    walletExposure,
    summaryRows,
    monthlyTransactionRows,
    yearlyTransactionRows,
    transactionCategoryRows,
    withdrawalStatusRows,
    transactionStatusRows,
    transactionCurrencyRows,
    orderSummaryRows,
    monthlyOrderRows,
    yearlyOrderRows,
    orderCurrencyRows,
  ] = await Promise.all([
    getWalletExposureSummary(),
    summaryRowsPromise,
    monthlyTransactionRowsPromise,
    yearlyTransactionRowsPromise,
    transactionCategoryRowsPromise,
    withdrawalStatusRowsPromise,
    transactionStatusRowsPromise,
    transactionCurrencyRowsPromise,
    orderSummaryPromise,
    monthlyOrderRowsPromise,
    yearlyOrderRowsPromise,
    orderCurrencyRowsPromise,
  ]);

  const summaryRow = summaryRows[0] || {};
  const orderSummaryRow = orderSummaryRows[0] || {};

  const withdrawalState = buildWithdrawalState(
    withdrawalStatusRows.map((row) => ({
      status: row._id,
      amount: normalizeNumber(row.amount),
      count: normalizeNumber(row.count),
    })),
  );

  const totalCashIn = roundAmount(normalizeNumber(summaryRow.walletFunding) + normalizeNumber(orderSummaryRow.paidOrderVolume));
  const totalCashOut = roundAmount(normalizeNumber(summaryRow.successfulWithdrawals) + normalizeNumber(summaryRow.walletRefunds));
  const netCashFlow = roundAmount(totalCashIn - totalCashOut);

  const monthlyTransactionMap = new Map(monthlyTransactionRows.map((row) => [normalizeNumber(row._id), row]));
  const monthlyOrderMap = new Map(monthlyOrderRows.map((row) => [normalizeNumber(row._id), row]));
  const monthlyTrend = MONTH_LABELS.map((label, index) => {
    const month = index + 1;
    const transactionRow = monthlyTransactionMap.get(month) || {};
    const orderRow = monthlyOrderMap.get(month) || {};
    const cashIn = roundAmount(normalizeNumber(transactionRow.walletFunding) + normalizeNumber(orderRow.paidOrderVolume));
    const cashOut = roundAmount(normalizeNumber(transactionRow.cashOut));
    const netFlow = roundAmount(cashIn - cashOut);

    return {
      month,
      label,
      cashIn,
      cashOut,
      netFlow,
      walletFunding: roundAmount(transactionRow.walletFunding),
      paidOrderVolume: roundAmount(orderRow.paidOrderVolume),
      platformRevenue: roundAmount(transactionRow.platformRevenue),
      campaignSpend: roundAmount(transactionRow.campaignSpend),
      promoterPayouts: roundAmount(transactionRow.promoterPayouts),
      refundedVolume: roundAmount(orderRow.refundedVolume),
      paidOrders: normalizeNumber(orderRow.paidOrders),
    };
  });

  const yearlyTransactionMap = new Map(yearlyTransactionRows.map((row) => [normalizeNumber(row._id), row]));
  const yearlyOrderMap = new Map(yearlyOrderRows.map((row) => [normalizeNumber(row._id), row]));
  const yearlyTrend = Array.from({ length: trendYears }, (_, index) => year - trendYears + 1 + index)
    .map((trendYear) => {
      const transactionRow = yearlyTransactionMap.get(trendYear) || {};
      const orderRow = yearlyOrderMap.get(trendYear) || {};
      const cashIn = roundAmount(normalizeNumber(transactionRow.walletFunding) + normalizeNumber(orderRow.paidOrderVolume));
      const cashOut = roundAmount(normalizeNumber(transactionRow.cashOut));

      return {
        year: trendYear,
        label: `${trendYear}`,
        cashIn,
        cashOut,
        netFlow: roundAmount(cashIn - cashOut),
        walletFunding: roundAmount(transactionRow.walletFunding),
        paidOrderVolume: roundAmount(orderRow.paidOrderVolume),
        platformRevenue: roundAmount(transactionRow.platformRevenue),
        campaignSpend: roundAmount(transactionRow.campaignSpend),
        paidOrders: normalizeNumber(orderRow.paidOrders),
      };
    });

  const txCategoryTotals = transactionCategoryRows.reduce((sum, row) => sum + normalizeNumber(row.amount), 0);
  const incomeCategoryRows = [];
  const expenseCategoryRows = [];

  for (const row of transactionCategoryRows) {
    const category = row._id;
    const amount = roundAmount(row.amount);
    const count = normalizeNumber(row.count);

    if (CASH_INFLOW_CATEGORIES.includes(category) || PLATFORM_REVENUE_CATEGORIES.includes(category)) {
      incomeCategoryRows.push({
        key: category,
        label: CATEGORY_LABELS[category] || category,
        amount,
        count,
      });
    }

    if (CASH_OUTFLOW_CATEGORIES.includes(category) || PROMOTER_PAYOUT_CATEGORIES.includes(category) || category === 'transfer') {
      expenseCategoryRows.push({
        key: category,
        label: CATEGORY_LABELS[category] || category,
        amount,
        count,
      });
    }
  }

  incomeCategoryRows.push({
    key: 'storefront_sales',
    label: CATEGORY_LABELS.storefront_sales,
    amount: roundAmount(orderSummaryRow.paidOrderVolume),
    count: normalizeNumber(orderSummaryRow.paidOrders),
  });

  const totalIncomeCategoryAmount = incomeCategoryRows.reduce((sum, row) => sum + normalizeNumber(row.amount), 0);
  const totalExpenseCategoryAmount = expenseCategoryRows.reduce((sum, row) => sum + normalizeNumber(row.amount), 0);

  const transactionStatusTotal = transactionStatusRows.reduce((sum, row) => sum + normalizeNumber(row.count), 0);
  const withdrawalStatusTotal = withdrawalStatusRows.reduce((sum, row) => sum + normalizeNumber(row.amount), 0);

  const mergedCurrencyRows = new Map();
  const mergeCurrencyRow = (row) => {
    const currency = row._id || DEFAULT_BASE_CURRENCY;
    const current = mergedCurrencyRows.get(currency) || {
      key: currency,
      label: currency,
      amount: 0,
      nativeAmount: 0,
      count: 0,
    };

    current.amount += normalizeNumber(row.amount);
    current.nativeAmount += normalizeNumber(row.nativeAmount);
    current.count += normalizeNumber(row.count);
    mergedCurrencyRows.set(currency, current);
  };

  transactionCurrencyRows.forEach(mergeCurrencyRow);
  orderCurrencyRows.forEach(mergeCurrencyRow);

  const currencyRows = Array.from(mergedCurrencyRows.values());
  const currencyTotalAmount = currencyRows.reduce((sum, row) => sum + normalizeNumber(row.amount), 0);

  const availableYears = Array.from(new Set([
    year,
    ...yearlyTrend.map((item) => item.year),
  ])).sort((left, right) => right - left);

  const averageOrderValue = normalizeNumber(orderSummaryRow.paidOrders)
    ? roundAmount(normalizeNumber(orderSummaryRow.paidOrderVolume) / normalizeNumber(orderSummaryRow.paidOrders))
    : 0;

  const insights = [];

  if (walletExposure.totalReserved > walletExposure.totalAvailable * 0.6) {
    insights.push({
      tone: 'warning',
      title: 'High escrow exposure',
      message: `${toShare(walletExposure.totalReserved, walletExposure.totalAvailable + walletExposure.totalReserved)}% of current wallet value is sitting in reserve. Review delivery release turnaround and refund queues.`,
    });
  }

  if (withdrawalState.totalCount > 0 && (withdrawalState.failedCount + withdrawalState.rejectedCount) > 0) {
    insights.push({
      tone: 'accent',
      title: 'Withdrawal friction',
      message: `${withdrawalState.failedCount + withdrawalState.rejectedCount} withdrawals failed or were rejected in ${year}. That is ${toShare(withdrawalState.failedCount + withdrawalState.rejectedCount, withdrawalState.totalCount)}% of the queue.`,
    });
  }

  if (normalizeNumber(orderSummaryRow.paidOrderVolume) > normalizeNumber(summaryRow.walletFunding)) {
    insights.push({
      tone: 'success',
      title: 'Storefront is driving more inflow',
      message: `Storefront GMV outpaced direct wallet funding in ${year}, which suggests the commerce side is becoming a stronger revenue driver.`,
    });
  }

  if (normalizeNumber(summaryRow.campaignSpend) > 0) {
    insights.push({
      tone: 'info',
      title: 'Ad demand pulse',
      message: `Campaign spend reached ${roundAmount(summaryRow.campaignSpend).toLocaleString()} ${baseCurrency} in ${year}, while promoter payouts landed at ${roundAmount(summaryRow.promoterPayouts).toLocaleString()} ${baseCurrency}.`,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    baseCurrency,
    availableYears,
    summary: {
      year,
      baseCurrency,
      totalCashIn,
      totalCashOut,
      netCashFlow,
      walletFunding: roundAmount(summaryRow.walletFunding),
      storefrontVolume: roundAmount(orderSummaryRow.paidOrderVolume),
      platformRevenue: roundAmount(summaryRow.platformRevenue),
      campaignSpend: roundAmount(summaryRow.campaignSpend),
      promoterPayouts: roundAmount(summaryRow.promoterPayouts),
      walletRefunds: roundAmount(summaryRow.walletRefunds),
      totalTransactions: normalizeNumber(summaryRow.totalTransactions),
      successfulTransactions: normalizeNumber(summaryRow.successfulTransactions),
      totalWithdrawalCount: withdrawalState.totalCount,
      totalWithdrawalAmount: roundAmount(withdrawalState.totalAmount),
      successfulWithdrawalCount: withdrawalState.successfulCount,
      successfulWithdrawals: roundAmount(withdrawalState.successfulAmount),
      processingWithdrawalCount: withdrawalState.processingCount,
      processingWithdrawals: roundAmount(withdrawalState.processingAmount),
      pendingApprovalCount: withdrawalState.pendingApprovalCount,
      pendingApprovals: roundAmount(withdrawalState.pendingApprovalAmount),
      failedWithdrawalCount: withdrawalState.failedCount + withdrawalState.rejectedCount,
      failedWithdrawals: roundAmount(withdrawalState.failedAmount + withdrawalState.rejectedAmount),
      activeBalance: roundAmount(walletExposure.totalAvailable),
      reservedBalance: roundAmount(walletExposure.totalReserved),
      marketerAvailable: roundAmount(walletExposure.marketerAvailable),
      marketerReserved: roundAmount(walletExposure.marketerReserved),
      promoterAvailable: roundAmount(walletExposure.promoterAvailable),
      promoterReserved: roundAmount(walletExposure.promoterReserved),
      paidOrders: normalizeNumber(orderSummaryRow.paidOrders),
      totalOrders: normalizeNumber(orderSummaryRow.totalOrders),
      averageOrderValue,
    },
    monthlyTrend,
    yearlyTrend,
    incomeCategories: buildBreakdownItems(incomeCategoryRows, totalIncomeCategoryAmount, topRows),
    expenseCategories: buildBreakdownItems(expenseCategoryRows, totalExpenseCategoryAmount, topRows),
    withdrawalStatuses: withdrawalStatusRows
      .map((row) => ({
        key: row._id,
        label: STATUS_LABELS[row._id] || row._id,
        amount: roundAmount(row.amount),
        count: normalizeNumber(row.count),
        share: toShare(row.amount, withdrawalStatusTotal),
      }))
      .sort((left, right) => right.amount - left.amount),
    transactionStatuses: transactionStatusRows
      .map((row) => ({
        key: row._id,
        label: STATUS_LABELS[row._id] || row._id,
        amount: roundAmount(row.amount),
        count: normalizeNumber(row.count),
        share: toShare(row.count, transactionStatusTotal),
      }))
      .sort((left, right) => right.count - left.count),
    currencyMix: currencyRows
      .map((row) => ({
        key: row.key,
        label: row.label,
        amount: roundAmount(row.amount),
        nativeAmount: roundAmount(row.nativeAmount),
        count: normalizeNumber(row.count),
        share: toShare(row.amount, currencyTotalAmount),
      }))
      .sort((left, right) => right.amount - left.amount)
      .slice(0, topRows),
    commerce: {
      totalOrders: normalizeNumber(orderSummaryRow.totalOrders),
      paidOrders: normalizeNumber(orderSummaryRow.paidOrders),
      guestOrders: normalizeNumber(orderSummaryRow.guestOrders),
      registeredOrders: normalizeNumber(orderSummaryRow.registeredOrders),
      paidOrderVolume: roundAmount(orderSummaryRow.paidOrderVolume),
      averageOrderValue,
      refundedOrders: normalizeNumber(orderSummaryRow.refundedOrders),
      refundedVolume: roundAmount(orderSummaryRow.refundedVolume),
      totalPromoterCommission: roundAmount(orderSummaryRow.totalPromoterCommission),
      heldEscrow: roundAmount(orderSummaryRow.heldEscrow),
      releasedEscrow: roundAmount(orderSummaryRow.releasedEscrow),
      marketerReserved: roundAmount(orderSummaryRow.marketerReserved),
      promoterReserved: roundAmount(orderSummaryRow.promoterReserved),
    },
    walletExposure: {
      totalAvailable: roundAmount(walletExposure.totalAvailable),
      totalReserved: roundAmount(walletExposure.totalReserved),
      marketerAvailable: roundAmount(walletExposure.marketerAvailable),
      marketerReserved: roundAmount(walletExposure.marketerReserved),
      promoterAvailable: roundAmount(walletExposure.promoterAvailable),
      promoterReserved: roundAmount(walletExposure.promoterReserved),
      balancesByCurrency: walletExposure.balancesByCurrency,
      reservedByCurrency: walletExposure.reservedByCurrency,
    },
    insights,
    notes: [
      `All reporting amounts are normalised to ${baseCurrency} where conversion metadata exists.`,
      'Storefront refund volume reflects fully refunded orders. Partial refunds are counted in order volume and refund counts, but the refunded amount may be understated if the partial value was not stored separately.',
    ],
  };
};

export const getFinancialOverviewPayload = async () => {
  const currentYear = new Date().getUTCFullYear();
  const analytics = await buildFinancialAnalytics({ year: currentYear, trendYears: 5, top: 8 });
  const [recentTransactions, pendingWithdrawals, processingWithdrawals, successfulWithdrawals, failedWithdrawals] = await Promise.all([
    getRecentTransactions(10),
    getWithdrawalQueue('pending_approval', 5),
    getWithdrawalQueue('processing', 5),
    getWithdrawalQueue('successful', 5),
    getWithdrawalQueue('failed', 5),
  ]);

  return {
    stats: analytics.summary,
    recentTransactions,
    pendingWithdrawals,
    processingWithdrawals,
    successfulWithdrawals,
    failedWithdrawals,
  };
};

export const getFinancialStatsPayload = async (year = null) => {
  const analytics = await buildFinancialAnalytics({ year });
  return analytics.summary;
};

export const getAdminTransactions = async ({
  type,
  category,
  status,
  page = 1,
  limit = 20,
  startDate,
  endDate,
} = {}) => {
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(200, Number(limit) || 20));
  const skip = (pageNumber - 1) * pageSize;

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  const basePipeline = buildWalletTransactionStages({ startDate: start, endDate: end });
  const filters = {};

  if (type) {
    filters.type = type;
  }

  if (category) {
    filters.category = category;
  }

  if (status) {
    filters.status = status;
  }

  const filterStages = Object.keys(filters).length ? [{ $match: filters }] : [];

  const [rows, totalRows] = await Promise.all([
    aggregateTransactions([
      ...basePipeline,
      ...filterStages,
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: pageSize },
    ]),
    aggregateTransactions([
      ...basePipeline,
      ...filterStages,
      { $count: 'count' },
    ]),
  ]);

  return {
    transactions: rows.map((row) => ({
      id: row.transactionId?.toString?.() || '',
      userId: row.userId?.toString?.() || '',
      userName: row.userName || 'Unknown user',
      userRole: row.walletType || row.userRole || 'marketer',
      type: row.type,
      category: row.category,
      amount: roundAmount(row.amount),
      amountPayable: roundAmount(row.amountPayable),
      fee: roundAmount(row.fee),
      description: row.description || CATEGORY_LABELS[row.category] || 'Wallet transaction',
      status: row.status,
      createdAt: row.createdAt,
      processedAt: row.processedAt || null,
      reference: row.reference || '',
      transferCode: row.transferCode || null,
      failureReason: row.failureReason || null,
      currency: row.currency || DEFAULT_BASE_CURRENCY,
      baseCurrency: row.baseCurrency || DEFAULT_BASE_CURRENCY,
      bankDetails: row.bankDetails || null,
    })),
    total: normalizeNumber(totalRows[0]?.count),
    page: pageNumber,
    limit: pageSize,
  };
};

const getPaymentMeta = (row) => {
  const meta = row.meta || {};
  const paystackResponse = meta.paystackResponse || {};
  const webhookPayload = meta.fullWebhookPayload || {};

  return {
    providerPaymentId: paystackResponse.id || webhookPayload.id || null,
    channel: paystackResponse.channel || webhookPayload.channel || meta.channel || null,
    domain: paystackResponse.domain || webhookPayload.domain || null,
    paidAt: paystackResponse.paidAt || webhookPayload.paidAt || row.processedAt || null,
    ipAddress: paystackResponse.ipAddress || webhookPayload.ipAddress || null,
    quoteBaseCurrency: meta.quote?.baseCurrency || row.baseCurrency || DEFAULT_BASE_CURRENCY,
    quoteTargetCurrency: meta.quote?.targetCurrency || row.currency || DEFAULT_BASE_CURRENCY,
  };
};

const mapDepositRow = (row) => {
  const paymentMeta = getPaymentMeta(row);

  return {
    depositId: row.transactionId?.toString?.() || '',
    userId: row.userId?.toString?.() || '',
    userName: row.userName || 'Unknown user',
    userEmail: row.userEmail || '',
    userRole: row.userRole || 'marketer',
    walletType: row.walletType || 'marketer',
    amount: roundAmount(row.amount),
    nativeAmount: roundAmount(row.nativeAmount),
    settlementAmount: row.settlementAmount === null ? null : roundAmount(row.settlementAmount),
    fee: roundAmount(row.fee),
    currency: row.currency || DEFAULT_BASE_CURRENCY,
    baseCurrency: row.baseCurrency || DEFAULT_BASE_CURRENCY,
    settlementCurrency: row.settlementCurrency || row.currency || DEFAULT_BASE_CURRENCY,
    exchangeRate: row.exchangeRate || null,
    gateway: row.gateway || 'system',
    status: row.status,
    description: row.description || CATEGORY_LABELS.deposit,
    reference: row.reference || '',
    createdAt: row.createdAt,
    processedAt: row.processedAt || null,
    paymentChannel: paymentMeta.channel,
    providerPaymentId: paymentMeta.providerPaymentId,
    domain: paymentMeta.domain,
    paidAt: paymentMeta.paidAt,
    ipAddress: paymentMeta.ipAddress,
  };
};

const buildDepositFilterStages = ({
  status,
  gateway,
  currency,
  walletType,
  search,
} = {}) => {
  const match = {
    category: 'deposit',
    type: 'credit',
  };

  if (status && status !== 'all') {
    match.status = status;
  }

  if (gateway && gateway !== 'all') {
    match.gateway = gateway;
  }

  if (currency && currency !== 'all') {
    match.$or = [
      { currency: String(currency).toUpperCase() },
      { baseCurrency: String(currency).toUpperCase() },
      { settlementCurrency: String(currency).toUpperCase() },
    ];
  }

  if (walletType && walletType !== 'all') {
    match.walletType = walletType;
  }

  const stages = [{ $match: match }];

  if (search) {
    const safeRegex = new RegExp(escapeRegex(search).slice(0, 80), 'i');
    stages.push({
      $match: {
        $or: [
          { userName: safeRegex },
          { userEmail: safeRegex },
          { reference: safeRegex },
          { description: safeRegex },
          { gateway: safeRegex },
          { currency: safeRegex },
          { baseCurrency: safeRegex },
        ],
      },
    });
  }

  return stages;
};

const buildDepositSummary = (rows = []) => {
  const summaryRow = rows[0] || {};
  const statusRows = summaryRow.statuses || [];
  const gatewayRows = summaryRow.gateways || [];
  const currencyRows = summaryRow.currencies || [];
  const trendRows = summaryRow.dailyTrend || [];
  const totalAmount = normalizeNumber(summaryRow.totalAmount);

  return {
    totalAmount: roundAmount(totalAmount),
    totalNativeAmount: roundAmount(summaryRow.totalNativeAmount),
    totalFees: roundAmount(summaryRow.totalFees),
    totalCount: normalizeNumber(summaryRow.totalCount),
    successfulAmount: roundAmount(summaryRow.successfulAmount),
    successfulCount: normalizeNumber(summaryRow.successfulCount),
    pendingAmount: roundAmount(summaryRow.pendingAmount),
    pendingCount: normalizeNumber(summaryRow.pendingCount),
    failedAmount: roundAmount(summaryRow.failedAmount),
    failedCount: normalizeNumber(summaryRow.failedCount),
    averageDeposit: normalizeNumber(summaryRow.totalCount)
      ? roundAmount(totalAmount / normalizeNumber(summaryRow.totalCount))
      : 0,
    statuses: statusRows
      .map((row) => ({
        key: row._id || 'unknown',
        label: STATUS_LABELS[row._id] || row._id || 'Unknown',
        amount: roundAmount(row.amount),
        count: normalizeNumber(row.count),
        share: toShare(row.amount, totalAmount),
      }))
      .sort((left, right) => right.amount - left.amount),
    gateways: gatewayRows
      .map((row) => ({
        key: row._id || 'system',
        label: row._id || 'System',
        amount: roundAmount(row.amount),
        count: normalizeNumber(row.count),
        share: toShare(row.amount, totalAmount),
      }))
      .sort((left, right) => right.amount - left.amount),
    currencies: currencyRows
      .map((row) => ({
        key: row._id || DEFAULT_BASE_CURRENCY,
        label: row._id || DEFAULT_BASE_CURRENCY,
        amount: roundAmount(row.amount),
        nativeAmount: roundAmount(row.nativeAmount),
        count: normalizeNumber(row.count),
        share: toShare(row.amount, totalAmount),
      }))
      .sort((left, right) => right.amount - left.amount),
    dailyTrend: trendRows
      .map((row) => ({
        date: row._id,
        amount: roundAmount(row.amount),
        count: normalizeNumber(row.count),
      }))
      .sort((left, right) => String(left.date).localeCompare(String(right.date))),
  };
};

export const getAdminDeposits = async ({
  status = 'all',
  gateway = 'all',
  currency = 'all',
  walletType = 'all',
  search = '',
  page = 1,
  limit = 50,
  fromDate,
  toDate,
  startDate,
  endDate,
  maxLimit = 500,
} = {}) => {
  const pageNumber = getPageNumber(page);
  const pageSize = getPageSize(limit, 50, maxLimit);
  const skip = (pageNumber - 1) * pageSize;
  const start = getValidDate(fromDate || startDate);
  const end = getInclusiveEndDate(toDate || endDate);
  const basePipeline = buildWalletTransactionStages({ startDate: start, endDate: end });
  const filterStages = buildDepositFilterStages({
    status,
    gateway,
    currency,
    walletType,
    search,
  });

  const [rows, totalRows, summaryRows] = await Promise.all([
    aggregateTransactions([
      ...basePipeline,
      ...filterStages,
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: pageSize },
    ]),
    aggregateTransactions([
      ...basePipeline,
      ...filterStages,
      { $count: 'count' },
    ]),
    aggregateTransactions([
      ...basePipeline,
      ...filterStages,
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalAmount: { $sum: '$amount' },
                totalNativeAmount: { $sum: '$nativeAmount' },
                totalFees: { $sum: '$fee' },
                totalCount: { $sum: 1 },
                successfulAmount: {
                  $sum: { $cond: [{ $in: ['$status', SUCCESS_STATUSES] }, '$amount', 0] },
                },
                successfulCount: {
                  $sum: { $cond: [{ $in: ['$status', SUCCESS_STATUSES] }, 1, 0] },
                },
                pendingAmount: {
                  $sum: { $cond: [{ $in: ['$status', ['pending', 'processing', 'initiated']] }, '$amount', 0] },
                },
                pendingCount: {
                  $sum: { $cond: [{ $in: ['$status', ['pending', 'processing', 'initiated']] }, 1, 0] },
                },
                failedAmount: {
                  $sum: { $cond: [{ $in: ['$status', ['failed', 'declined', 'cancelled', 'abandoned']] }, '$amount', 0] },
                },
                failedCount: {
                  $sum: { $cond: [{ $in: ['$status', ['failed', 'declined', 'cancelled', 'abandoned']] }, 1, 0] },
                },
              },
            },
          ],
          statuses: [
            { $group: { _id: '$status', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
          ],
          gateways: [
            { $group: { _id: '$gateway', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
          ],
          currencies: [
            { $group: { _id: '$baseCurrency', amount: { $sum: '$amount' }, nativeAmount: { $sum: '$nativeAmount' }, count: { $sum: 1 } } },
          ],
          dailyTrend: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                amount: { $sum: '$amount' },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: -1 } },
            { $limit: 14 },
          ],
        },
      },
      {
        $project: {
          totals: { $ifNull: [{ $arrayElemAt: ['$totals', 0] }, {}] },
          statuses: 1,
          gateways: 1,
          currencies: 1,
          dailyTrend: 1,
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              '$totals',
              {
                statuses: '$statuses',
                gateways: '$gateways',
                currencies: '$currencies',
                dailyTrend: '$dailyTrend',
              },
            ],
          },
        },
      },
    ]),
  ]);

  return {
    deposits: rows.map(mapDepositRow),
    total: normalizeNumber(totalRows[0]?.count),
    page: pageNumber,
    limit: pageSize,
    summary: buildDepositSummary(summaryRows),
    filters: {
      status,
      gateway,
      currency,
      walletType,
      search,
      fromDate: start?.toISOString?.() || null,
      toDate: end?.toISOString?.() || null,
    },
  };
};

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

export const exportAdminDeposits = async (query = {}) => {
  const data = await getAdminDeposits({
    ...query,
    page: 1,
    limit: Math.min(5000, Number(query.limit) || 5000),
    maxLimit: 5000,
  });

  const headers = [
    'Deposit ID',
    'User',
    'Email',
    'Role',
    'Wallet',
    'Amount',
    'Currency',
    'Native Amount',
    'Native Currency',
    'Settlement Amount',
    'Settlement Currency',
    'Gateway',
    'Channel',
    'Status',
    'Reference',
    'Provider Payment ID',
    'Created At',
    'Processed At',
  ];

  const rows = data.deposits.map((deposit) => [
    deposit.depositId,
    deposit.userName,
    deposit.userEmail,
    deposit.userRole,
    deposit.walletType,
    deposit.amount,
    deposit.baseCurrency,
    deposit.nativeAmount,
    deposit.currency,
    deposit.settlementAmount ?? '',
    deposit.settlementCurrency,
    deposit.gateway,
    deposit.paymentChannel || '',
    deposit.status,
    deposit.reference,
    deposit.providerPaymentId || '',
    deposit.createdAt ? new Date(deposit.createdAt).toISOString() : '',
    deposit.processedAt ? new Date(deposit.processedAt).toISOString() : '',
  ]);

  return {
    filename: `deposits_${new Date().toISOString().slice(0, 10)}.csv`,
    mimeType: 'text/csv',
    csv: [
      headers.map(csvCell).join(','),
      ...rows.map((row) => row.map(csvCell).join(',')),
    ].join('\n'),
    total: data.total,
    exported: data.deposits.length,
  };
};
