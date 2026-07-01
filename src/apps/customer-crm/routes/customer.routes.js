import express from "express";
import { authenticate } from "../../../shared/middleware/auth.middleware.js";
import {
  getCustomers,
  getCustomer,
  createCustomerHandler,
  updateCustomerHandler,
  deleteCustomerHandler,
  importCustomersHandler,
  addCustomerLogHandler,
  updateConsentHandler,
  getCustomerAnalyticsHandler,
  getTagsHandler,
  sendCustomerSmsHandler,
  sendBulkCustomerSmsHandler,
  sendCustomerEmailHandler,
} from "../controllers/customer.controller.js";
import { sendBulkSms } from "../controllers/bulk-sms.controller.js";
import { getSmsHistory } from "../controllers/admin-sms.controller.js";
import { requireAdmin } from "../../../shared/middleware/authorization.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Analytics / metadata routes (must come before :id routes)
router.get("/analytics/summary", getCustomerAnalyticsHandler);
router.get("/tags", getTagsHandler);

// Import
router.post("/import", importCustomersHandler);

// CRUD
router.get("/", getCustomers);
router.get("/:id", getCustomer);
router.post("/", createCustomerHandler);
router.patch("/:id", updateCustomerHandler);
router.delete("/:id", deleteCustomerHandler);

// Activity log
router.post("/:id/logs", addCustomerLogHandler);

// Consent
router.post("/:id/consent", updateConsentHandler);

// SMS & Email communication (must come before :id routes that could match)
router.post("/send-bulk-sms", sendBulkCustomerSmsHandler);
router.post("/:id/send-sms", sendCustomerSmsHandler);
router.post("/:id/send-email", sendCustomerEmailHandler);

// SMS history routes
router.post("/sms/bulk", sendBulkSms);
router.get("/sms/history", requireAdmin, getSmsHistory);

export default router;
