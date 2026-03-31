import { VALIDATION, COMMON_TRIGGERS } from "./whatsapp-integration.constants.js";

/**
 * Extract variables from template message
 * @param {string} message - Template message
 * @returns {Array} - Array of variable names
 */
export const extractVariables = (message) => {
  const variableRegex = /{([a-zA-Z][a-zA-Z0-9]*)}/g;
  const matches = message.match(variableRegex) || [];
  
  return matches.map(match => match.slice(1, -1)); // Remove the curly braces
};

/**
 * Validate template message and extract variables
 * @param {string} message - Template message
 * @returns {Object} - Validation result with extracted variables
 */
export const validateTemplateMessage = (message) => {
  if (!message || message.trim().length === 0) {
    return {
      isValid: false,
      error: 'Template message is required'
    };
  }

  const trimmedMessage = message.trim();
  
  if (trimmedMessage.length < VALIDATION.TEMPLATE_MESSAGE.MIN_LENGTH) {
    return {
      isValid: false,
      error: `Template message must be at least ${VALIDATION.TEMPLATE_MESSAGE.MIN_LENGTH} characters`
    };
  }

  if (trimmedMessage.length > VALIDATION.TEMPLATE_MESSAGE.MAX_LENGTH) {
    return {
      isValid: false,
      error: `Template message cannot exceed ${VALIDATION.TEMPLATE_MESSAGE.MAX_LENGTH} characters`
    };
  }

  // Extract and validate variables
  const variables = extractVariables(trimmedMessage);
  const invalidVariables = variables.filter(v => 
    !VALIDATION.VARIABLE_NAME.PATTERN.test(v) || 
    v.length > VALIDATION.VARIABLE_NAME.MAX_LENGTH
  );

  if (invalidVariables.length > 0) {
    return {
      isValid: false,
      error: `Invalid variable names: ${invalidVariables.join(', ')}. Variables must start with a letter and contain only letters and numbers.`
    };
  }

  return {
    isValid: true,
    message: trimmedMessage,
    variables
  };
};

/**
 * Validate template name
 * @param {string} name - Template name
 * @returns {Object} - Validation result
 */
export const validateTemplateName = (name) => {
  if (!name || name.trim().length === 0) {
    return {
      isValid: false,
      error: 'Template name is required'
    };
  }

  const trimmedName = name.trim();
  
  if (trimmedName.length < VALIDATION.TEMPLATE_NAME.MIN_LENGTH) {
    return {
      isValid: false,
      error: `Template name must be at least ${VALIDATION.TEMPLATE_NAME.MIN_LENGTH} characters`
    };
  }

  if (trimmedName.length > VALIDATION.TEMPLATE_NAME.MAX_LENGTH) {
    return {
      isValid: false,
      error: `Template name cannot exceed ${VALIDATION.TEMPLATE_NAME.MAX_LENGTH} characters`
    };
  }

  return {
    isValid: true,
    name: trimmedName
  };
};

/**
 * Validate quick reply
 * @param {string} reply - Quick reply text
 * @returns {Object} - Validation result
 */
export const validateQuickReply = (reply) => {
  if (!reply || reply.trim().length === 0) {
    return {
      isValid: false,
      error: 'Quick reply is required'
    };
  }

  const trimmedReply = reply.trim();
  
  if (trimmedReply.length > VALIDATION.QUICK_REPLY.MAX_LENGTH) {
    return {
      isValid: false,
      error: `Quick reply cannot exceed ${VALIDATION.QUICK_REPLY.MAX_LENGTH} characters`
    };
  }

  return {
    isValid: true,
    reply: trimmedReply
  };
};

/**
 * Validate auto response
 * @param {Object} autoResponse - Auto response object
 * @returns {Object} - Validation result
 */
export const validateAutoResponse = (autoResponse) => {
  if (!autoResponse.trigger || autoResponse.trigger.trim().length === 0) {
    return {
      isValid: false,
      error: 'Auto response trigger is required'
    };
  }

  if (!autoResponse.response || autoResponse.response.trim().length === 0) {
    return {
      isValid: false,
      error: 'Auto response message is required'
    };
  }

  const trimmedTrigger = autoResponse.trigger.trim().toLowerCase();
  const trimmedResponse = autoResponse.response.trim();

  if (trimmedTrigger.length < VALIDATION.AUTO_RESPONSE_TRIGGER.MIN_LENGTH) {
    return {
      isValid: false,
      error: `Trigger must be at least ${VALIDATION.AUTO_RESPONSE_TRIGGER.MIN_LENGTH} characters`
    };
  }

  if (trimmedTrigger.length > VALIDATION.AUTO_RESPONSE_TRIGGER.MAX_LENGTH) {
    return {
      isValid: false,
      error: `Trigger cannot exceed ${VALIDATION.AUTO_RESPONSE_TRIGGER.MAX_LENGTH} characters`
    };
  }

  if (trimmedResponse.length < VALIDATION.AUTO_RESPONSE_MESSAGE.MIN_LENGTH) {
    return {
      isValid: false,
      error: `Response must be at least ${VALIDATION.AUTO_RESPONSE_MESSAGE.MIN_LENGTH} characters`
    };
  }

  if (trimmedResponse.length > VALIDATION.AUTO_RESPONSE_MESSAGE.MAX_LENGTH) {
    return {
      isValid: false,
      error: `Response cannot exceed ${VALIDATION.AUTO_RESPONSE_MESSAGE.MAX_LENGTH} characters`
    };
  }

  return {
    isValid: true,
    trigger: trimmedTrigger,
    response: trimmedResponse
  };
};

/**
 * Find matching auto response for a message
 * @param {Array} autoResponses - Array of auto response objects
 * @param {string} message - Incoming message
 * @returns {Object|null} - Matching auto response or null
 */
export const findMatchingAutoResponse = (autoResponses, message) => {
  if (!autoResponses || autoResponses.length === 0 || !message) return null;
  
  const lowerMessage = message.toLowerCase();
  
  // First try exact match
  let match = autoResponses.find(ar => 
    lowerMessage.includes(ar.trigger.toLowerCase())
  );
  
  if (match) return match;
  
  // Then try common triggers
  for (const [category, triggers] of Object.entries(COMMON_TRIGGERS)) {
    const matchedTrigger = triggers.find(trigger => lowerMessage.includes(trigger));
    if (matchedTrigger) {
      // Return the first auto response that matches the category
      return autoResponses.find(ar => 
        triggers.includes(ar.trigger.toLowerCase())
      );
    }
  }
  
  return null;
};

/**
 * Render template with variables
 * @param {string} template - Template message
 * @param {Object} variables - Variable values
 * @returns {string} - Rendered message
 */
export const renderTemplate = (template, variables = {}) => {
  let renderedMessage = template;
  
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = new RegExp(`{${key}}`, 'g');
    renderedMessage = renderedMessage.replace(placeholder, value || `{${key}}`);
  });
  
  return renderedMessage;
};

/**
 * Format integration for response
 * @param {Object} integration - WhatsApp integration document
 * @returns {Object} - Formatted integration
 */
export const formatIntegrationResponse = (integration) => {
  const integrationObj = integration.toObject ? integration.toObject() : integration;
  
  return {
    id: integrationObj._id,
    store: integrationObj.store,
    templates: integrationObj.templates?.map(template => ({
      id: template._id,
      name: template.name,
      message: template.message,
      variables: template.variables || [],
      isActive: template.isActive,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt
    })) || [],
    quickReplies: integrationObj.quickReplies || [],
    autoResponses: integrationObj.autoResponses?.map(ar => ({
      id: ar._id,
      trigger: ar.trigger,
      response: ar.response,
      createdAt: ar.createdAt,
      updatedAt: ar.updatedAt
    })) || [],
    stats: {
      totalTemplates: integrationObj.templates?.length || 0,
      totalQuickReplies: integrationObj.quickReplies?.length || 0,
      totalAutoResponses: integrationObj.autoResponses?.length || 0,
      activeTemplates: integrationObj.templates?.filter(t => t.isActive).length || 0
    }
  };
};