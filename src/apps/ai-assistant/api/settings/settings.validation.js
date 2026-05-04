import Joi from 'joi';

export const addWhatsAppSchema = Joi.object({
  phoneNumber: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required(),
});

export const removeWhatsAppSchema = Joi.object({
  phoneNumber: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required(),
});

export const toggleAiSchema = Joi.object({
  phoneNumber: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required(),
  aiEnabled: Joi.boolean().required(),
});

export const reconnectSchema = Joi.object({
  phoneNumber: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required(),
});

export const businessSchema = Joi.object({
  businessId: Joi.string().hex().length(24).required(), // ObjectId
});

export const notificationPreferencesSchema = Joi.object({
  newMessage: Joi.boolean().required(),
  escalation: Joi.boolean().required(),
  paymentConfirmation: Joi.boolean().required(),
});

export const subscriptionSchema = Joi.object({
  planId: Joi.string().valid('basic', 'advanced').required(),
});