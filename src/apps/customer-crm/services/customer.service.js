import mongoose from "mongoose";
import { CustomerModel, CustomerGroupModel, ContactLogModel, ConsentRecordModel } from "../models/index.js";

/* ────── Helpers ────── */

const normalizeString = (v) => (typeof v === "string" ? v.trim() : "");
const normalizeEmail = (v) => normalizeString(v).toLowerCase();
const clampString = (v, max = 1000) => normalizeString(v).slice(0, max);

const parsePage = (v, fallback = 1) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const parseLimit = (v, fallback = 25, max = 200) => {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
};

const parseDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toObjectId = (v) => (mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(v) : null);

const validateOwner = async (marketerId) => {
  if (!mongoose.Types.ObjectId.isValid(marketerId)) {
    const err = new Error("Invalid marketer ID");
    err.status = 400;
    throw err;
  }
};

/* ────── List customers (paginated, filtered) ────── */

export const listCustomers = async ({
  marketerId,
  storeId = null,
  groupId = null,
  search = "",
  tags = [],
  lifecycleStage = "",
  source = "",
  startDate = null,
  endDate = null,
  page = 1,
  limit = 25,
  sortBy = "createdAt",
  sortOrder = "desc",
}) => {
  await validateOwner(marketerId);

  const match = { marketer: new mongoose.Types.ObjectId(marketerId), isActive: true };

  if (storeId && mongoose.Types.ObjectId.isValid(storeId)) {
    match.store = new mongoose.Types.ObjectId(storeId);
  }

  if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
    match.groups = new mongoose.Types.ObjectId(groupId);
  }

  if (lifecycleStage && lifecycleStage !== "all") {
    match.lifecycleStage = lifecycleStage;
  }

  if (source && source !== "all") {
    match.source = source;
  }

  if (tags && Array.isArray(tags) && tags.length > 0) {
    match.tags = { $in: tags.map((t) => normalizeString(t).toLowerCase()).filter(Boolean) };
  }

  const from = parseDate(startDate);
  const to = parseDate(endDate);
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = from;
    if (to) match.createdAt.$lte = to;
  }

  const trimmedSearch = normalizeString(search);
  if (trimmedSearch) {
    const regex = new RegExp(escapeRegex(trimmedSearch), "i");
    match.$or = [
      { displayName: regex },
      { email: regex },
      { phone: regex },
      { notes: regex },
    ];
  }

  const safePage = parsePage(page, 1);
  const safeLimit = parseLimit(limit, 25, 200);
  const skip = (safePage - 1) * safeLimit;

  const sortDir = sortOrder === "asc" ? 1 : -1;
  const sortObj = { [sortBy]: sortDir };

  const [items, total] = await Promise.all([
    CustomerModel.find(match)
      .sort(sortObj)
      .skip(skip)
      .limit(safeLimit)
      .populate("groups", "name color")
      .lean(),
    CustomerModel.countDocuments(match),
  ]);

  // Collect unique tags in use by this marketer (for autocomplete)
  const tagAgg = await CustomerModel.aggregate([
    { $match: { marketer: new mongoose.Types.ObjectId(marketerId), isActive: true } },
    { $unwind: "$tags" },
    { $group: { _id: "$tags" } },
    { $sort: { _id: 1 } },
    { $limit: 200 },
  ]);
  const availableTags = tagAgg.map((t) => t._id).filter(Boolean);

  return {
    customers: items,
    availableTags,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
};

/* ────── Get a single customer ────── */

export const getCustomerById = async ({ customerId, marketerId }) => {
  await validateOwner(marketerId);

  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    const err = new Error("Invalid customer ID");
    err.status = 400;
    throw err;
  }

  const customer = await CustomerModel.findOne({
    _id: customerId,
    marketer: marketerId,
  })
    .populate("groups", "name color")
    .lean();

  if (!customer) {
    const err = new Error("Customer not found");
    err.status = 404;
    throw err;
  }

  // Fetch recent activity logs
  const logs = await ContactLogModel.find({ customer: customerId, marketer: marketerId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return { customer, logs };
};

/* ────── Create a customer ────── */

export const createCustomer = async ({ marketerId, data }) => {
  await validateOwner(marketerId);

  const {
    displayName,
    email = "",
    phone = "",
    phoneCountryCode = "+234",
    storeId = null,
    promotionId = null,
    campaignId = null,
    source = "manual",
    tags = [],
    notes = "",
    consentSms = false,
    consentEmail = false,
  } = data;

  if (!normalizeString(displayName)) {
    const err = new Error("Display name is required");
    err.status = 400;
    throw err;
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizeString(phone);

  if (!normalizedEmail && !normalizedPhone) {
    const err = new Error("Either email or phone is required");
    err.status = 400;
    throw err;
  }

  // Check duplicate
  const dupFilter = { marketer: new mongoose.Types.ObjectId(marketerId), isActive: true };
  if (normalizedEmail) dupFilter.email = normalizedEmail;
  else dupFilter.phone = normalizedPhone;

  const existing = await CustomerModel.findOne(dupFilter).lean();
  if (existing) {
    const err = new Error("A contact with this email or phone already exists");
    err.status = 409;
    throw err;
  }

  const now = new Date();

  const customer = await CustomerModel.create({
    marketer: marketerId,
    store: toObjectId(storeId),
    promotionId: toObjectId(promotionId),
    campaignId: toObjectId(campaignId),
    source,
    displayName: normalizeString(displayName),
    email: normalizedEmail,
    phone: normalizedPhone,
    phoneCountryCode,
    tags: tags.map((t) => normalizeString(t).toLowerCase()).filter(Boolean),
    notes: clampString(notes, 5000),
    consent: {
      sms: consentSms,
      email: consentEmail,
      smsOptInAt: consentSms ? now : null,
      emailOptInAt: consentEmail ? now : null,
      consentSource: source,
    },
  });

  // Log consent if opted in
  if (consentSms) {
    await ConsentRecordModel.create({
      customer: customer._id,
      marketer: marketerId,
      channel: "sms",
      action: "opt_in",
      source: "manual_entry",
    });
  }
  if (consentEmail) {
    await ConsentRecordModel.create({
      customer: customer._id,
      marketer: marketerId,
      channel: "email",
      action: "opt_in",
      source: "manual_entry",
    });
  }

  // Auto-log creation note
  await ContactLogModel.create({
    customer: customer._id,
    marketer: marketerId,
    type: "note",
    content: `Contact created via ${source}.`,
  });

  return CustomerModel.findById(customer._id).populate("groups", "name color").lean();
};

/* ────── Update a customer ────── */

export const updateCustomer = async ({ customerId, marketerId, data }) => {
  await validateOwner(marketerId);

  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    const err = new Error("Invalid customer ID");
    err.status = 400;
    throw err;
  }

  const customer = await CustomerModel.findOne({ _id: customerId, marketer: marketerId });
  if (!customer) {
    const err = new Error("Customer not found");
    err.status = 404;
    throw err;
  }

  const updates = {};
  const allowedFields = [
    "displayName", "email", "phone", "phoneCountryCode",
    "notes", "lifecycleStage", "tags", "customFields",
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      if (field === "tags") {
        updates.tags = data.tags.map((t) => normalizeString(t).toLowerCase()).filter(Boolean);
      } else if (field === "email") {
        updates.email = normalizeEmail(data[field]);
      } else if (field === "phone") {
        updates.phone = normalizeString(data[field]);
      } else if (field === "displayName") {
        updates.displayName = normalizeString(data[field]);
      } else if (field === "notes") {
        updates.notes = clampString(data[field], 5000);
      } else {
        updates[field] = data[field];
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    await CustomerModel.updateOne({ _id: customerId }, { $set: updates });
  }

  return CustomerModel.findById(customerId).populate("groups", "name color").lean();
};

/* ────── Soft-delete a customer ────── */

export const deleteCustomer = async ({ customerId, marketerId }) => {
  await validateOwner(marketerId);

  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    const err = new Error("Invalid customer ID");
    err.status = 400;
    throw err;
  }

  const result = await CustomerModel.updateOne(
    { _id: customerId, marketer: marketerId },
    { $set: { isActive: false } }
  );

  if (result.matchedCount === 0) {
    const err = new Error("Customer not found");
    err.status = 404;
    throw err;
  }

  return { deleted: true };
};

/* ────── Bulk import customers ────── */

export const bulkImportCustomers = async ({ marketerId, customers }) => {
  await validateOwner(marketerId);

  if (!Array.isArray(customers) || customers.length === 0) {
    const err = new Error("No customers provided");
    err.status = 400;
    throw err;
  }

  if (customers.length > 5000) {
    const err = new Error("Maximum 5000 customers per import");
    err.status = 400;
    throw err;
  }

  const results = { imported: 0, skipped: 0, errors: [] };
  const now = new Date();

  for (let i = 0; i < customers.length; i++) {
    const row = customers[i];
    try {
      const displayName = normalizeString(row.displayName || row.name || "");
      const email = normalizeEmail(row.email || "");
      const phone = normalizeString(row.phone || "");

      if (!displayName || (!email && !phone)) {
        results.skipped++;
        continue;
      }

      // Check duplicate by email or phone
      const dupFilter = { marketer: new mongoose.Types.ObjectId(marketerId), isActive: true };
      if (email) dupFilter.email = email;
      else dupFilter.phone = phone;

      const existing = await CustomerModel.findOne(dupFilter).lean();
      if (existing) {
        results.skipped++;
        continue;
      }

      const tags = Array.isArray(row.tags)
        ? row.tags.map((t) => normalizeString(t).toLowerCase()).filter(Boolean)
        : (typeof row.tags === "string" ? row.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) : []);

      await CustomerModel.create({
        marketer: marketerId,
        source: "csv_import",
        displayName,
        email,
        phone,
        phoneCountryCode: normalizeString(row.phoneCountryCode || "+234"),
        tags,
        notes: clampString(row.notes || "", 5000),
        consent: {
          sms: row.consentSms === true || row.consentSms === "true",
          email: row.consentEmail === true || row.consentEmail === "true",
          smsOptInAt: (row.consentSms === true || row.consentSms === "true") ? now : null,
          emailOptInAt: (row.consentEmail === true || row.consentEmail === "true") ? now : null,
          consentSource: "bulk_import",
        },
      });

      results.imported++;
    } catch (err) {
      results.errors.push({ row: i + 1, message: err.message });
      results.skipped++;
    }
  }

  return results;
};

/* ────── Add activity log entry ────── */

export const addCustomerLog = async ({ customerId, marketerId, data }) => {
  await validateOwner(marketerId);

  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    const err = new Error("Invalid customer ID");
    err.status = 400;
    throw err;
  }

  const customer = await CustomerModel.findOne({ _id: customerId, marketer: marketerId }).lean();
  if (!customer) {
    const err = new Error("Customer not found");
    err.status = 404;
    throw err;
  }

  const { type = "note", direction = "outgoing", subject = "", content } = data;

  if (!content) {
    const err = new Error("Content is required");
    err.status = 400;
    throw err;
  }

  const log = await ContactLogModel.create({
    customer: customerId,
    marketer: marketerId,
    type,
    direction,
    subject: clampString(subject, 300),
    content: clampString(content, 10000),
  });

  // Update last contacted
  await CustomerModel.updateOne(
    { _id: customerId },
    { $set: { lastContactedAt: new Date() } }
  );

  return log.toObject();
};

/* ────── Update consent ────── */

export const updateCustomerConsent = async ({ customerId, marketerId, channel, action, source = "manual_entry" }) => {
  await validateOwner(marketerId);

  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    const err = new Error("Invalid customer ID");
    err.status = 400;
    throw err;
  }

  const customer = await CustomerModel.findOne({ _id: customerId, marketer: marketerId });
  if (!customer) {
    const err = new Error("Customer not found");
    err.status = 404;
    throw err;
  }

  const now = new Date();
  const consentUpdate = {};

  if (channel === "sms") {
    consentUpdate["consent.sms"] = action === "opt_in";
    consentUpdate[`consent.sms${action === "opt_in" ? "OptIn" : "OptOut"}At`] = now;
  } else if (channel === "email") {
    consentUpdate["consent.email"] = action === "opt_in";
    consentUpdate[`consent.email${action === "opt_in" ? "OptIn" : "OptOut"}At`] = now;
  }

  await CustomerModel.updateOne({ _id: customerId }, { $set: consentUpdate });

  await ConsentRecordModel.create({
    customer: customerId,
    marketer: marketerId,
    channel,
    action,
    source,
    consentVersion: "1.0",
  });

  return CustomerModel.findById(customerId).populate("groups", "name color").lean();
};

/* ────── Customer summary analytics ────── */

export const getCustomerAnalytics = async ({ marketerId }) => {
  await validateOwner(marketerId);

  const oid = new mongoose.Types.ObjectId(marketerId);

  const [total, lifecycleAgg, tagAgg, recent] = await Promise.all([
    CustomerModel.countDocuments({ marketer: oid, isActive: true }),
    CustomerModel.aggregate([
      { $match: { marketer: oid, isActive: true } },
      { $group: { _id: "$lifecycleStage", count: { $sum: 1 } } },
    ]),
    CustomerModel.aggregate([
      { $match: { marketer: oid, isActive: true } },
      { $unwind: { path: "$tags", preserveNullAndEmptyArrays: false } },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    CustomerModel.find({ marketer: oid, isActive: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("displayName email createdAt source")
      .lean(),
  ]);

  const totals = { total, withSmsConsent: 0, withEmailConsent: 0 };
  const consentAgg = await CustomerModel.aggregate([
    { $match: { marketer: oid, isActive: true } },
    {
      $group: {
        _id: null,
        smsConsent: { $sum: { $cond: ["$consent.sms", 1, 0] } },
        emailConsent: { $sum: { $cond: ["$consent.email", 1, 0] } },
      },
    },
  ]);

  if (consentAgg.length > 0) {
    totals.withSmsConsent = consentAgg[0].smsConsent;
    totals.withEmailConsent = consentAgg[0].emailConsent;
  }

  return {
    totals,
    lifecycleBreakdown: Object.fromEntries(lifecycleAgg.map((l) => [l._id, l.count])),
    topTags: tagAgg,
    recentAdditions: recent,
  };
};

/* ────── Tags autocomplete ────── */

export const getMarketerTags = async ({ marketerId }) => {
  await validateOwner(marketerId);

  const tagAgg = await CustomerModel.aggregate([
    { $match: { marketer: new mongoose.Types.ObjectId(marketerId), isActive: true } },
    { $unwind: "$tags" },
    { $group: { _id: "$tags", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 200 },
  ]);

  return tagAgg.map((t) => ({ name: t._id, count: t.count }));
};
