import mongoose from 'mongoose';
import { ServiceModel } from '../../models/service/service.model.js';

export async function getPromoterStoreServices(req, res) {
  try {
    const {
      page = 1,
      limit = 12,
      categories,
      minPrice,
      maxPrice,
      minCommission,
      maxCommission,
      search,
      sortBy = 'commission',
      sortDirection = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;
    const activePromoterId = req.userId;

    const filterQuery = {
      isActive: true,
      isDeleted: false,
      isPublished: true,
      'affiliate.enabled': { $ne: false },
    };

    if (categories) {
      const categoryArray = categories.split(',').map(c => c.trim()).filter(Boolean);
      if (categoryArray.length) filterQuery.category = { $in: categoryArray };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filterQuery.price = {};
      if (minPrice !== undefined) filterQuery.price.$gte = parseFloat(minPrice) || 0;
      if (maxPrice !== undefined) filterQuery.price.$lte = parseFloat(maxPrice) || Number.MAX_SAFE_INTEGER;
    }

    if (minCommission !== undefined || maxCommission !== undefined) {
      const field = 'affiliate.leadCommission';
      filterQuery[field] = {};
      if (minCommission !== undefined) filterQuery[field].$gte = parseFloat(minCommission) || 0;
      if (maxCommission !== undefined) filterQuery[field].$lte = parseFloat(maxCommission) || Number.MAX_SAFE_INTEGER;
    }

    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filterQuery.$or = [
        { name: regex },
        { description: regex },
        { category: regex },
        { 'includes': regex },
      ];
    }

    const total = await ServiceModel.countDocuments(filterQuery);

    const sortMapping = {
      commission: { 'affiliate.leadCommission': sortDirection === 'desc' ? -1 : 1 },
      popularity: { inquiryCount: sortDirection === 'desc' ? -1 : 1 },
      price: { price: sortDirection === 'desc' ? -1 : 1 },
      newest: { createdAt: -1 },
      name: { name: 1 },
    };

    const sortObj = sortMapping[sortBy] || { createdAt: -1 };

    const services = await ServiceModel.find(filterQuery)
      .populate('store', 'name logo description isVerified verificationTier')
      .populate('provider', 'firstName lastName avatar')
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .lean();

    const serviceIds = services.map(s => s._id);

    // Aggregate across all services for stats
    const allStats = serviceIds.length > 0 ? await ServiceModel.aggregate([
      {
        $match: {
          _id: { $in: serviceIds.map(id => new mongoose.Types.ObjectId(id.toString())) },
          isActive: true,
          isDeleted: false,
          isPublished: true,
        }
      },
      {
        $group: {
          _id: null,
          minLeadCommission: { $min: '$affiliate.leadCommission' },
          maxLeadCommission: { $max: '$affiliate.leadCommission' },
          avgLeadCommission: { $avg: '$affiliate.leadCommission' },
          minBookingCommission: { $min: '$affiliate.bookingCommissionRate' },
          maxBookingCommission: { $max: '$affiliate.bookingCommissionRate' },
          avgBookingCommission: { $avg: '$affiliate.bookingCommissionRate' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          avgPrice: { $avg: '$price' },
          totalViews: { $sum: '$viewCount' },
          totalInquiries: { $sum: '$inquiryCount' },
          totalBookings: { $sum: '$bookingCount' },
          perLeadCount: {
            $sum: { $cond: [{ $eq: ['$affiliate.commissionType', 'per_lead'] }, 1, 0] }
          },
          perBookingCount: {
            $sum: { $cond: [{ $eq: ['$affiliate.commissionType', 'per_booking'] }, 1, 0] }
          },
        }
      }
    ]) : [];

    // Category aggregation
    const categoriesAgg = await ServiceModel.aggregate([
      { $match: { isActive: true, isDeleted: false, isPublished: true, 'affiliate.enabled': { $ne: false } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Global commission stats for filter metadata
    const commissionStats = await ServiceModel.aggregate([
      { $match: { isActive: true, isDeleted: false, isPublished: true, 'affiliate.enabled': { $ne: false } } },
      {
        $group: {
          _id: null,
          minLead: { $min: '$affiliate.leadCommission' },
          maxLead: { $max: '$affiliate.leadCommission' },
          avgLead: { $avg: '$affiliate.leadCommission' },
          minBooking: { $min: '$affiliate.bookingCommissionRate' },
          maxBooking: { $max: '$affiliate.bookingCommissionRate' },
          avgBooking: { $avg: '$affiliate.bookingCommissionRate' },
          highCommission: { $sum: { $cond: [{ $gte: ['$affiliate.leadCommission', 500] }, 1, 0] } },
        }
      }
    ]);

    // Price range stats
    const priceStats = await ServiceModel.aggregate([
      { $match: { isActive: true, isDeleted: false, isPublished: true } },
      { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' }, avg: { $avg: '$price' } } },
    ]);

    const transformedServices = services.map(service => ({
      _id: service._id,
      type: 'service',
      name: service.name,
      description: service.description?.substring(0, 200) || '',
      category: service.category,
      pricingType: service.pricingType,
      price: service.price,
      hourlyRate: service.hourlyRate,
      packages: service.packages?.map(p => ({ name: p.name, price: p.price })),
      images: (service.media?.length ? service.media : service.portfolio)?.slice(0, 1) || [],
      media: service.media || [],
      affiliate: {
        enabled: service.affiliate?.enabled !== false,
        commissionType: service.affiliate?.commissionType || 'per_lead',
        leadCommission: service.affiliate?.leadCommission || 200,
        bookingCommissionRate: service.affiliate?.bookingCommissionRate || 200,
      },
      store: {
        _id: service.store?._id,
        name: service.store?.name,
        logo: service.store?.logo,
        isVerified: service.store?.isVerified,
        verificationTier: service.store?.verificationTier,
      },
      provider: service.provider ? {
        _id: service.provider._id,
        name: `${service.provider.firstName || ''} ${service.provider.lastName || ''}`.trim(),
        avatar: service.provider.avatar,
      } : null,
      stats: {
        views: service.viewCount || 0,
        inquiries: service.inquiryCount || 0,
        bookings: service.bookingCount || 0,
        rating: service.averageRating || 0,
        ratingCount: service.ratingCount || 0,
      },
      availability: service.availability,
      deliveryTime: service.deliveryTime,
      createdAt: service.createdAt,
    }));

    const statsData = allStats[0] || {};
    const commissionData = commissionStats[0] || {};
    const priceData = priceStats[0] || {};

    res.status(200).json({
      success: true,
      count: transformedServices.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: transformedServices,
      stats: {
        totalServices: total,
        totalViews: statsData.totalViews || 0,
        totalInquiries: statsData.totalInquiries || 0,
        totalBookings: statsData.totalBookings || 0,
        perLeadCount: statsData.perLeadCount || 0,
        perBookingCount: statsData.perBookingCount || 0,
      },
      filters: {
        categories: categoriesAgg,
        priceRange: {
          min: priceData.min || 0,
          max: priceData.max || 0,
          avg: priceData.avg || 0,
        },
        commissionRange: {
          lead: {
            min: commissionData.minLead || 0,
            max: commissionData.maxLead || 0,
            avg: commissionData.avgLead || 0,
          },
          booking: {
            min: commissionData.minBooking || 0,
            max: commissionData.maxBooking || 0,
            avg: commissionData.avgBooking || 0,
          },
          highCommission: commissionData.highCommission || 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching promoter services:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services for promotion.',
    });
  }
}
