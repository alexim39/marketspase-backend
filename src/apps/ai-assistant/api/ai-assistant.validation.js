import Joi from 'joi';

export const faqSchema = Joi.object({
  question: Joi.string().required().min(3).max(500),
  answer: Joi.string().required().min(1).max(2000),
  category: Joi.string().max(50).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
});

export const updateFaqSchema = Joi.object({
  question: Joi.string().min(3).max(500),
  answer: Joi.string().min(1).max(2000),
  category: Joi.string().max(50),
  tags: Joi.array().items(Joi.string()),
}).min(1);

export const settingsSchema = Joi.object({
  tone: Joi.string().valid('friendly', 'professional', 'sales'),
  language: Joi.string().valid('english', 'pidgin'),
  aiEnabled: Joi.boolean(),
}).min(1);

export const toggleSchema = Joi.object({
  aiEnabled: Joi.boolean().required(),
});

export const sendMessageSchema = Joi.object({
  text: Joi.string().required().min(1).max(1000),
});

export const templateSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  content: Joi.string().required().min(1).max(1000),
  category: Joi.string().valid('payment', 'product', 'greeting', 'escalation', 'custom'),
  variables: Joi.array().items(Joi.string()),
});