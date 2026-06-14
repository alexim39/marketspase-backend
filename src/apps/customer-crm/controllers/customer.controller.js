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
 * @desc    Soft-delete a customer contact
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
