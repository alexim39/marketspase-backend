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
  escalationRules: Joi.object({
    escalateOnKeywords: Joi.boolean(),
    lowConfidence: Joi.boolean(),
    complaints: Joi.boolean(),
    highValue: Joi.boolean(),
    keywords: Joi.array().items(Joi.string().max(80)),
  }),
  autoLinks: Joi.object({
    storefrontUrl: Joi.string().allow('').max(500),
    paymentLink: Joi.string().allow('').max(500),
    productLinks: Joi.array().items(Joi.object({
      label: Joi.string().allow('').max(100),
      url: Joi.string().allow('').max(500),
    })),
  }),
  responseSettings: Joi.object({
    responseDelaySeconds: Joi.number().min(0).max(60),
    maxAiRepliesBeforeEscalation: Joi.number().min(1).max(50),
    businessHours: Joi.object({
      enabled: Joi.boolean(),
      start: Joi.string().allow('').max(10),
      end: Joi.string().allow('').max(10),
      timezone: Joi.string().allow('').max(80),
    }),
  }),
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
