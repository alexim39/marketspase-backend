import { UserModel } from '../../models/user/index.js';
import mongoose from 'mongoose';

// Helper function to build query from filters
const buildUserQuery = (filters = {}) => {
  const query = { isDeleted: false };
  
  // Role filter
  if (filters.role) {
    query.role = filters.role;
  }
  
  // Status filters
  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive === 'true' ? true : filters.isActive === 'false' ? false : filters.isActive;
  }
  
  if (filters.isVerified !== undefined) {
    query.isVerified = filters.isVerified === 'true' ? true : filters.isVerified === 'false' ? false : filters.isVerified;
  }
  
  // Search filter (text search across multiple fields)
  if (filters.search && filters.search.trim()) {
    const searchRegex = new RegExp(filters.search.trim(), 'i');
    query.$or = [
      { username: searchRegex },
      { email: searchRegex },
      { displayName: searchRegex },
      { 'personalInfo.phone': searchRegex }
    ];
  }
  
  return query;
};

// Helper function to build sorting
const buildUserSort = (sort = '-createdAt') => {
  const sortObj = {};
  
  if (sort.startsWith('-')) {
    sortObj[sort.substring(1)] = -1; // Descending
  } else {
    sortObj[sort] = 1; // Ascending
  }
  
  return sortObj;
};

// Helper function to build projection (fields to return)
const buildUserProjection = () => ({
  password: 0,
  notificationSettings: 0,
  deviceTokens: 0,
  sseConnections: 0,
  activityLog: 0,
  'wallets.marketer.transactions': 0,
  'wallets.promoter.transactions': 0
})


/**
 * Stream users for export (CSV/JSON)
 * GET /api/user/admin/users/stream
 */
export const streamUsers = async (req, res) => {
  try {
    const { 
      search = '',
      role,
      isActive,
      isVerified 
    } = req.query;

    // Build query
    const query = buildUserQuery({ search, role, isActive, isVerified });
    const projection = buildUserProjection();

    // Set headers for streaming
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="users_export_${new Date().toISOString().split('T')[0]}.json"`);
    // NOTE: `Transfer-Encoding` is prohibited in HTTP/2/HTTP/3 and can trigger `ERR_HTTP2_PROTOCOL_ERROR`
    // behind some proxies/CDNs. Let Node/proxies negotiate the framing.

    // Create cursor for streaming
    const cursor = UserModel.find(query)
      .select(projection)
      .sort({ createdAt: -1 })
      .cursor({ batchSize: 100 });

    let isFirst = true;
    
    // Start streaming JSON array
    res.write('{"success":true,"message":"Users export stream","data":{"users":[');

    cursor.on('data', (user) => {
      // Transform user data for export
      const exportUser = {
        _id: user._id,
        uid: user.uid,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        isVerified: user.isVerified,
        isDeleted: user.isDeleted,
        balance: user.role === 'marketer' 
          ? user.wallets?.marketer?.balance || 0 
          : user.wallets?.promoter?.balance || 0,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };

      const userJson = JSON.stringify(exportUser);
      
      if (isFirst) {
        res.write(userJson);
        isFirst = false;
      } else {
        res.write(',' + userJson);
      }
    });

    cursor.on('end', () => {
      res.write(']}}');
      res.end();
    });

    cursor.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error during user export'
        });
      } else {
        res.end();
      }
    });

  } catch (error) {
    console.error('Error starting user stream:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'An error occurred while exporting users.'
      });
    }
  }
};
