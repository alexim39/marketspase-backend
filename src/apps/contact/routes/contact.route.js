import express from 'express';
import { ContactController } from '../controllers/contact.controller.js'

import {
  getContactMessages,
  getContactMessage,
  updateContactStatus,
  updateContactPriority,
  assignContactToAdmin,
  addAdminNote,
  updateTags,
  markAsRead,
  toggleArchive,
  setFollowUpDate,
  deleteContact,
  bulkUpdateStatus,
  exportContacts,
  getContactStats,
  getAvailableAdmins
} from '../controllers/contact.controller.js';


const router = express.Router();

// User contact
router.post('/submit', ContactController);

// Get all contact messages with filters
router.get('/', getContactMessages);

// Get contact statistics
router.get('/stats', getContactStats);

// Export contacts
router.get('/export', exportContacts);

// Get available admins for assignment
router.get('/admins', getAvailableAdmins);

// Get single contact message
router.get('/:id', getContactMessage);

// Update contact status
router.patch('/:id/status', updateContactStatus);

// Update contact priority
router.patch('/:id/priority', updateContactPriority);

// Assign contact to admin
router.patch('/:id/assign', assignContactToAdmin);

// Add admin note
router.post('/:id/notes', addAdminNote);

// Update tags
router.patch('/:id/tags', updateTags);

// Mark as read
router.patch('/:id/read', markAsRead);

// Archive/unarchive
router.patch('/:id/archive', toggleArchive);

// Set follow-up date
router.patch('/:id/followup', setFollowUpDate);

// Delete contact
router.delete('/:id', deleteContact);

// Bulk operations
router.post('/bulk/status', bulkUpdateStatus);


export default router;