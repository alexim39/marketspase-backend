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
} from "./customer.service.js";

import {
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  addGroupMembers,
  removeGroupMembers,
} from "./group.service.js";

export {
  // Customer
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
  // Groups
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  addGroupMembers,
  removeGroupMembers,
};
