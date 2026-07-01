import mongoose from "mongoose";
import { PromoterCollectionModel } from "../../models/promoter-collection/index.js";
import { ProductModel, PromotionTrackingModel } from "../../models/promotion/index.js";
import {
  getProductAffiliateSettings,
  calculateCommissionForAmount,
} from "../../services/storefront-affiliate.service.js";
import { computePromoterTier } from "../../../promotion/services/promoter-tier.service.js";

export const createCollection = async (req, res) => {
  try {
    const promoterId = req.userId;
    const { name, description, coverImage } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Collection name is required",
      });
    }

    const collection = new PromoterCollectionModel({
      promoter: promoterId,
      name,
      description: description || "",
      coverImage: coverImage || "",
    });

    await collection.save();

    return res.status(201).json({
      success: true,
      message: "Collection created successfully",
      data: collection,
    });
  } catch (error) {
    console.error("Create promoter collection error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create collection",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const listMyCollections = async (req, res) => {
  try {
    const promoterId = req.userId;

    const collections = await PromoterCollectionModel.find({
      promoter: promoterId,
    })
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: collections,
    });
  } catch (error) {
    console.error("List promoter collections error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch collections",
    });
  }
};

export const getCollection = async (req, res) => {
  try {
    const { id } = req.params;
    const promoterId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid collection ID",
      });
    }

    const collection = await PromoterCollectionModel.findOne({
      _id: id,
      promoter: promoterId,
    })
      .populate("products.productId", "name price images currency")
      .populate("products.storeId", "name storeLink logo");

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: collection,
    });
  } catch (error) {
    console.error("Get promoter collection error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch collection",
    });
  }
};

export const updateCollection = async (req, res) => {
  try {
    const { id } = req.params;
    const promoterId = req.userId;
    const { name, description, isPublic } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid collection ID",
      });
    }

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (description !== undefined) updateFields.description = description;
    if (isPublic !== undefined) updateFields.isPublic = Boolean(isPublic);

    const collection = await PromoterCollectionModel.findOneAndUpdate(
      { _id: id, promoter: promoterId },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Collection updated successfully",
      data: collection,
    });
  } catch (error) {
    console.error("Update promoter collection error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update collection",
    });
  }
};

export const updateCollectionProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const promoterId = req.userId;
    const { products } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid collection ID",
      });
    }

    if (!Array.isArray(products)) {
      return res.status(400).json({
        success: false,
        message: "Products must be an array",
      });
    }

    const collection = await PromoterCollectionModel.findOne({
      _id: id,
      promoter: promoterId,
    });

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    const newProductEntries = [];

    for (let i = 0; i < products.length; i++) {
      const entry = products[i];
      const { productId, storeId } = entry;

      if (!productId || !storeId) {
        return res.status(400).json({
          success: false,
          message: `Product at index ${i} must have productId and storeId`,
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(productId) ||
        !mongoose.Types.ObjectId.isValid(storeId)
      ) {
        return res.status(400).json({
          success: false,
          message: `Invalid productId or storeId at index ${i}`,
        });
      }

      const existingEntry = collection.products.find(
        (p) =>
          p.productId.toString() === productId.toString() &&
          p.storeId.toString() === storeId.toString()
      );

      if (existingEntry) {
        existingEntry.order = i;
        newProductEntries.push(existingEntry);
        continue;
      }

      const product = await ProductModel.findOne({
        _id: productId,
        isActive: true,
        isDeleted: false,
        isPublished: true,
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product ${productId} not found or not available`,
        });
      }

      let trackingCode = "";

      const existingPromotion = await PromotionTrackingModel.findOne({
        product: productId,
        promoter: promoterId,
        isActive: true,
      });

      if (existingPromotion) {
        trackingCode = existingPromotion.uniqueCode;
      } else {
        const affiliateSettings = getProductAffiliateSettings(product);
        if (!affiliateSettings.enabled) {
          return res.status(400).json({
            success: false,
            message: `Affiliate promotion is disabled for product ${productId}`,
          });
        }

        const promoterTier = await computePromoterTier(promoterId);
        const tierAdjustedCommission = calculateCommissionForAmount(
          100,
          affiliateSettings,
          promoterTier
        );
        const tierBonusRate = Math.round(
          (tierAdjustedCommission / 100) * 100 - affiliateSettings.commissionRate
        );

        const promotion = new PromotionTrackingModel({
          product: productId,
          promoter: promoterId,
          store: storeId,
          commissionRate: affiliateSettings.commissionRate + tierBonusRate,
          commissionType: affiliateSettings.commissionType,
          fixedCommission: affiliateSettings.fixedCommission,
          isActive: true,
          isApproved: affiliateSettings.autoApprovePromoters,
          startDate: new Date(),
          viewCount: 0,
          clickCount: 0,
          conversionCount: 0,
          earnings: 0,
          clickThroughRate: 0,
          conversionRate: 0,
          averageOrderValue: 0,
          deviceTypes: { mobile: 0, desktop: 0, tablet: 0 },
          metadata: {
            baseCommissionRate: affiliateSettings.commissionRate,
            tierBonus: tierBonusRate,
            promoterTier: promoterTier,
          },
        });

        await promotion.save();
        trackingCode = promotion.uniqueCode;
      }

      newProductEntries.push({
        productId,
        storeId,
        trackingCode,
        addedAt: new Date(),
        order: i,
      });
    }

    collection.products = newProductEntries;
    await collection.save();

    const populated = await PromoterCollectionModel.findById(collection._id)
      .populate("products.productId", "name price images currency")
      .populate("products.storeId", "name storeLink logo");

    return res.status(200).json({
      success: true,
      message: "Collection products updated successfully",
      data: populated,
    });
  } catch (error) {
    console.error("Update collection products error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update collection products",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const deleteCollection = async (req, res) => {
  try {
    const { id } = req.params;
    const promoterId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid collection ID",
      });
    }

    const collection = await PromoterCollectionModel.findOneAndDelete({
      _id: id,
      promoter: promoterId,
    });

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Collection deleted successfully",
    });
  } catch (error) {
    console.error("Delete promoter collection error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete collection",
    });
  }
};

export const getPublicCollectionBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const collection = await PromoterCollectionModel.findOne({
      slug,
      isPublic: true,
    })
      .populate("products.productId", "name price images currency")
      .populate("products.storeId", "name storeLink logo");

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    collection.viewCount = (collection.viewCount || 0) + 1;
    await collection.save();

    return res.status(200).json({
      success: true,
      data: collection,
    });
  } catch (error) {
    console.error("Get public collection error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch collection",
    });
  }
};
