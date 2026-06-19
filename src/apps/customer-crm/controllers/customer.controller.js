import {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  bulkImportCustomers,
  addCustomerLog,
  updateCustomerConsent,
  getCustomerAnalytics,
  getMarketerTags,
} from "../services/index.js";
import { sendSms, sendBulkSms } from "../services/sms.service.js";
import { sendEmail as sendCoreEmail } from "../../../core/email.service.js";
import { CustomerModel } from "../models/customer.model.js";
import { ContactLogModel } from "../models/contact-log.model.js";
import { UserModel } from "../../user/models/user/index.js";
import { applyWalletDebit, ensureWalletCurrencyState } from "../../wallet/services/wallet-ledger.service.js";
import { roundCurrencyAmount } from "../../wallet/services/payment-currency.service.js";

const SMS_COST_PER_RECIPIENT = 10;     // ₦10 per recipient
const SMS_CURRENCY = 'NGN';

/**
 * @desc    List customers for the authenticated marketer
 * @route   GET /api/v1/customers
 * @access  Private (Marketer)
 */
export const getCustomers = async (req, res) => {
  try {
    const {
      storeId, groupId, search, tags, lifecycleStage,
      source, startDate, endDate, page, limit,
      sortBy, sortOrder,
    } = req.query || {};

    const data = await listCustomers({
      marketerId: req.userId,
      storeId: storeId || null,
      groupId: groupId || null,
      search,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(",")) : [],
      lifecycleStage,
      source,
      startDate,
      endDate,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Get customers error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to load customers",
    });
  }
};

/**
 * @desc    Get a single customer with activity log
 * @route   GET /api/v1/customers/:id
 * @access  Private (Marketer)
 */
export const getCustomer = async (req, res) => {
  try {
    const data = await getCustomerById({
      customerId: req.params.id,
      marketerId: req.userId,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Get customer error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to load customer",
    });
  }
};

/**
 * @desc    Create a new customer contact
 * @route   POST /api/v1/customers
 * @access  Private (Marketer)
 */
export const createCustomerHandler = async (req, res) => {
  try {
    const customer = await createCustomer({
      marketerId: req.userId,
      data: req.body,
    });

    return res.status(201).json({ success: true, data: customer });
  } catch (error) {
    console.error("Create customer error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to create customer",
    });
  }
};

/**
 * @desc    Update a customer contact
 * @route   PATCH /api/v1/customers/:id
 * @access  Private (Marketer)
 */
export const updateCustomerHandler = async (req, res) => {
  try {
    const customer = await updateCustomer({
      customerId: req.params.id,
      marketerId: req.userId,
      data: req.body,
    });

    return res.status(200).json({ success: true, data: customer });
  } catch (error) {
    console.error("Update customer error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to update customer",
    });
  }
};

/**
 * @desc    Hard-delete a customer contact
 * @route   DELETE /api/v1/customers/:id
 * @access  Private (Marketer)
 */
export const deleteCustomerHandler = async (req, res) => {
  try {
    const result = await deleteCustomer({
      customerId: req.params.id,
      marketerId: req.userId,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Delete customer error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to delete customer",
    });
  }
};

/**
 * @desc    Bulk import customers from CSV
 * @route   POST /api/v1/customers/import
 * @access  Private (Marketer)
 */
export const importCustomersHandler = async (req, res) => {
  try {
    const result = await bulkImportCustomers({
      marketerId: req.userId,
      customers: req.body.customers,
    });

    return res.status(200).json({
      success: true,
      data: result,
      message: `Imported ${result.imported}, skipped ${result.skipped}`,
    });
  } catch (error) {
    console.error("Import customers error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to import customers",
    });
  }
};

/**
 * @desc    Add activity log entry for a customer
 * @route   POST /api/v1/customers/:id/logs
 * @access  Private (Marketer)
 */
export const addCustomerLogHandler = async (req, res) => {
  try {
    const log = await addCustomerLog({
      customerId: req.params.id,
      marketerId: req.userId,
      data: req.body,
    });

    return res.status(201).json({ success: true, data: log });
  } catch (error) {
    console.error("Add customer log error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to add log",
    });
  }
};

/**
 * @desc    Update a customer's consent preference
 * @route   POST /api/v1/customers/:id/consent
 * @access  Private (Marketer)
 */
export const updateConsentHandler = async (req, res) => {
  try {
    const { channel, action, source } = req.body;

    if (!channel || !["sms", "email"].includes(channel)) {
      return res.status(400).json({ success: false, message: "Channel must be 'sms' or 'email'" });
    }
    if (!action || !["opt_in", "opt_out"].includes(action)) {
      return res.status(400).json({ success: false, message: "Action must be 'opt_in' or 'opt_out'" });
    }

    const customer = await updateCustomerConsent({
      customerId: req.params.id,
      marketerId: req.userId,
      channel,
      action,
      source: source || "manual_entry",
    });

    return res.status(200).json({ success: true, data: customer });
  } catch (error) {
    console.error("Update consent error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to update consent",
    });
  }
};

/**
 * @desc    Get customer analytics summary
 * @route   GET /api/v1/customers/analytics/summary
 * @access  Private (Marketer)
 */
export const getCustomerAnalyticsHandler = async (req, res) => {
  try {
    const analytics = await getCustomerAnalytics({ marketerId: req.userId });
    return res.status(200).json({ success: true, data: analytics });
  } catch (error) {
    console.error("Customer analytics error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to load analytics",
    });
  }
};

/**
 * @desc    Get available tags for autocomplete
 * @route   GET /api/v1/customers/tags
 * @access  Private (Marketer)
 */
export const getTagsHandler = async (req, res) => {
  try {
    const tags = await getMarketerTags({ marketerId: req.userId });
    return res.status(200).json({ success: true, data: tags });
  } catch (error) {
    console.error("Get tags error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to load tags",
    });
  }
};

/**
 * Helper: Deduct N10 per SMS from marketer's main balance.
 * Returns the updated marketer document on success, or null if insufficient.
 * Throws if user not found or wallet is missing.
 */
const chargeMarketerForSms = async (marketerId, recipientCount) => {
  const totalCost = roundCurrencyAmount(SMS_COST_PER_RECIPIENT * recipientCount);
  const user = await UserModel.findById(marketerId);
  if (!user) throw Object.assign(new Error('Marketer account not found.'), { status: 404 });
  if (!user.wallets?.marketer) throw Object.assign(new Error('Marketer wallet not configured.'), { status: 400 });

  ensureWalletCurrencyState(user.wallets.marketer, SMS_CURRENCY);
  const balance = user.wallets.marketer.balance || 0;

  if (balance < totalCost) {
    return null; // insufficient balance — caller must handle
  }

  applyWalletDebit(user.wallets.marketer, {
    bucket: 'balance',
    amount: totalCost,
    currency: SMS_CURRENCY,
  });

  user.wallets.marketer.transactions.unshift({
    amount: totalCost,
    currency: SMS_CURRENCY,
    baseAmount: totalCost,
    baseCurrency: SMS_CURRENCY,
    settlementCurrency: SMS_CURRENCY,
    settlementAmount: totalCost,
    exchangeRate: 1,
    type: 'debit',
    category: 'sms',
    description: `SMS charge: ${recipientCount} recipient(s) × ₦${SMS_COST_PER_RECIPIENT}`,
    status: 'successful',
    reference: `SMS_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    gateway: 'system',
    createdAt: new Date(),
  });

  user.wallets.marketer.transactions = user.wallets.marketer.transactions.slice(0, 500);
  await user.save();
  return { user, totalCost, newBalance: user.wallets.marketer.balance };
};

/**
 * @desc    Send SMS to a single customer
 * @route   POST /api/v1/customers/:id/send-sms
 */
export const sendCustomerSmsHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }

    const customer = await CustomerModel.findById(id);
    if (!customer || customer.marketer.toString() !== req.userId) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }
    if (!customer.phone) {
      return res.status(400).json({ success: false, message: 'Customer has no phone number.' });
    }

    // Charge ₦10 from marketer wallet BEFORE sending
    const chargeResult = await chargeMarketerForSms(req.userId, 1);
    if (!chargeResult) {
      return res.status(402).json({
        success: false,
        message: `Insufficient balance. Sending this SMS costs ₦${SMS_COST_PER_RECIPIENT}. Please fund your wallet.`,
        code: 'INSUFFICIENT_BALANCE',
      });
    }

    const result = await sendSms(customer.phone, message.trim());

    await ContactLogModel.create({
      customer: id, marketer: req.userId,
      type: 'sms', direction: 'outgoing', content: message.trim(),
      metadata: {
        smsProviderId: result?.data?.reference || result?.reference || null,
        provider: 'bulksmsnigeria',
        cost: SMS_COST_PER_RECIPIENT,
        chargedAmount: SMS_COST_PER_RECIPIENT,
      },
    });

    await CustomerModel.findByIdAndUpdate(id, { $set: { lastContactedAt: new Date(), lastContactChannel: 'sms' } });

    return res.status(200).json({
      success: true,
      data: result,
      message: `SMS sent. ₦${SMS_COST_PER_RECIPIENT} deducted from your wallet.`,
      balance: chargeResult.newBalance,
      charged: SMS_COST_PER_RECIPIENT,
    });
  } catch (error) {
    console.error('Send SMS error:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to send SMS.' });
  }
};

/**
 * @desc    Send bulk SMS to selected customers
 * @route   POST /api/v1/customers/send-bulk-sms
 */
export const sendBulkCustomerSmsHandler = async (req, res) => {
  try {
    const { customerIds, message } = req.body;

    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No customers selected.' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }

    const customers = await CustomerModel.find({
      _id: { $in: customerIds },
      marketer: req.userId,
      phone: { $exists: true, $ne: null, $ne: '' },
    });

    if (customers.length === 0) {
      return res.status(400).json({ success: false, message: 'No customers with valid phone numbers found.' });
    }

    const totalCost = roundCurrencyAmount(SMS_COST_PER_RECIPIENT * customers.length);

    // Charge marketer BEFORE sending
    const chargeResult = await chargeMarketerForSms(req.userId, customers.length);
    if (!chargeResult) {
      return res.status(402).json({
        success: false,
        message: `Insufficient balance. Sending to ${customers.length} recipients costs ₦${totalCost}. Please fund your wallet.`,
        code: 'INSUFFICIENT_BALANCE',
      });
    }

    const phones = customers.map(c => c.phone).join(',');
    const result = await sendSms(phones, message.trim(), { customerReference: `BULK_${Date.now()}` });

    const logEntries = customers.map(c => ({
      customer: c._id, marketer: req.userId, type: 'sms',
      direction: 'outgoing', content: message.trim(),
      metadata: {
        smsProviderId: result?.data?.reference || result?.reference || null,
        provider: 'bulksmsnigeria',
        cost: SMS_COST_PER_RECIPIENT,
        chargedAmount: SMS_COST_PER_RECIPIENT,
      },
    }));
    await ContactLogModel.insertMany(logEntries);
    await CustomerModel.updateMany(
      { _id: { $in: customers.map(c => c._id) } },
      { $set: { lastContactedAt: new Date(), lastContactChannel: 'sms' } }
    );

    return res.status(200).json({
      success: true,
      data: { sent: customers.length, total: customerIds.length, result },
      message: `SMS sent to ${customers.length} customers. ₦${totalCost} deducted from your wallet.`,
      balance: chargeResult.newBalance,
      charged: totalCost,
    });
  } catch (error) {
    console.error('Bulk SMS error:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to send bulk SMS.' });
  }
};

/**
 * @desc    Send email to a single customer
 * @route   POST /api/v1/customers/:id/send-email
 */
export const sendCustomerEmailHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, body: emailBody } = req.body;

    if (!subject || !emailBody) {
      return res.status(400).json({ success: false, message: "Subject and body are required." });
    }

    const customer = await CustomerModel.findById(id);
    if (!customer || customer.marketer.toString() !== req.userId) {
      return res.status(404).json({ success: false, message: "Customer not found." });
    }

    if (!customer.email) {
      return res.status(400).json({ success: false, message: "Customer has no email address." });
    }

    await sendCoreEmail(customer.email, subject, emailBody);

    await ContactLogModel.create({
      customer: id, marketer: req.userId,
      type: 'email', direction: 'outgoing',
      subject, content: emailBody,
    });

    await CustomerModel.findByIdAndUpdate(id, { $set: { lastContactedAt: new Date(), lastContactChannel: 'email' } });

    return res.status(200).json({ success: true, message: "Email sent successfully." });
  } catch (error) {
    console.error("Send email error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to send email." });
  }
};
