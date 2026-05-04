import Joi from 'joi';

export const faqSchema = Joi.object({
  question: Joi.string().required().min(3),
  answer: Joi.string().required().min(1),
});

export const updateFaqSchema = Joi.object({
  question: Joi.string().min(3),
  answer: Joi.string().min(1),
}).min(1);

export const settingsSchema = Joi.object({
  tone: Joi.string().valid('friendly', 'professional', 'sales'),
  language: Joi.string().valid('english', 'pidgin'),
}).min(1);

export const toggleSchema = Joi.object({
  aiEnabled: Joi.boolean().required(),
});

export const sendMessageSchema = Joi.object({
  text: Joi.string().required(),
});