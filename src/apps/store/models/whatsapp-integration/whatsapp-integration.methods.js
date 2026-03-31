import {
  validateTemplateName,
  validateTemplateMessage,
  validateQuickReply,
  validateAutoResponse,
  renderTemplate,
  findMatchingAutoResponse,
  extractVariables
} from "./whatsapp-integration.utils.js";
import { ERROR_MESSAGES } from "./whatsapp-integration.constants.js";

export const setupWhatsAppIntegrationMethods = (schema) => {
  // Add template
  schema.methods.addTemplate = async function(templateData) {
    // Validate template name
    const nameValidation = validateTemplateName(templateData.name);
    if (!nameValidation.isValid) {
      throw new Error(nameValidation.error);
    }

    // Check for duplicate name
    const existingTemplate = this.templates.find(
      t => t.name.toLowerCase() === nameValidation.name.toLowerCase()
    );
    if (existingTemplate) {
      throw new Error(ERROR_MESSAGES.DUPLICATE_TEMPLATE_NAME);
    }

    // Validate template message
    const messageValidation = validateTemplateMessage(templateData.message);
    if (!messageValidation.isValid) {
      throw new Error(messageValidation.error);
    }

    // Create new template
    const newTemplate = {
      name: nameValidation.name,
      message: messageValidation.message,
      variables: messageValidation.variables,
      isActive: templateData.isActive !== undefined ? templateData.isActive : true,
      category: templateData.category || 'marketing',
      status: templateData.status || 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.templates.push(newTemplate);
    await this.save();

    return newTemplate;
  };

  // Update template
  schema.methods.updateTemplate = async function(templateId, updates) {
    const template = this.templates.id(templateId);
    if (!template) {
      throw new Error(ERROR_MESSAGES.TEMPLATE_NOT_FOUND);
    }

    // Validate name if being updated
    if (updates.name) {
      const nameValidation = validateTemplateName(updates.name);
      if (!nameValidation.isValid) {
        throw new Error(nameValidation.error);
      }

      // Check for duplicate name (excluding current template)
      const existingTemplate = this.templates.find(
        t => t.name.toLowerCase() === nameValidation.name.toLowerCase() && 
             t._id.toString() !== templateId
      );
      if (existingTemplate) {
        throw new Error(ERROR_MESSAGES.DUPLICATE_TEMPLATE_NAME);
      }

      template.name = nameValidation.name;
    }

    // Validate message if being updated
    if (updates.message) {
      const messageValidation = validateTemplateMessage(updates.message);
      if (!messageValidation.isValid) {
        throw new Error(messageValidation.error);
      }
      template.message = messageValidation.message;
      template.variables = messageValidation.variables;
    }

    // Update other fields
    if (updates.isActive !== undefined) template.isActive = updates.isActive;
    if (updates.category) template.category = updates.category;
    if (updates.status) template.status = updates.status;

    template.updatedAt = new Date();
    await this.save();

    return template;
  };

  // Delete template
  schema.methods.deleteTemplate = async function(templateId) {
    const template = this.templates.id(templateId);
    if (!template) {
      throw new Error(ERROR_MESSAGES.TEMPLATE_NOT_FOUND);
    }

    template.remove();
    await this.save();

    return true;
  };

  // Add quick reply
  schema.methods.addQuickReply = async function(reply) {
    const validation = validateQuickReply(reply);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    this.quickReplies.push(validation.reply);
    await this.save();

    return validation.reply;
  };

  // Remove quick reply
  schema.methods.removeQuickReply = async function(index) {
    if (index < 0 || index >= this.quickReplies.length) {
      throw new Error('Invalid quick reply index');
    }

    this.quickReplies.splice(index, 1);
    await this.save();

    return true;
  };

  // Add auto response
  schema.methods.addAutoResponse = async function(autoResponseData) {
    const validation = validateAutoResponse(autoResponseData);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // Check for duplicate trigger
    const existingResponse = this.autoResponses.find(
      ar => ar.trigger.toLowerCase() === validation.trigger.toLowerCase()
    );
    if (existingResponse) {
      throw new Error(ERROR_MESSAGES.TRIGGER_ALREADY_EXISTS);
    }

    const newAutoResponse = {
      trigger: validation.trigger,
      response: validation.response,
      isActive: autoResponseData.isActive !== undefined ? autoResponseData.isActive : true,
      priority: autoResponseData.priority || 0,
      matchType: autoResponseData.matchType || 'contains',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.autoResponses.push(newAutoResponse);
    // Sort by priority (higher priority first)
    this.autoResponses.sort((a, b) => b.priority - a.priority);
    
    await this.save();

    return newAutoResponse;
  };

  // Update auto response
  schema.methods.updateAutoResponse = async function(responseId, updates) {
    const autoResponse = this.autoResponses.id(responseId);
    if (!autoResponse) {
      throw new Error('Auto response not found');
    }

    if (updates.trigger) {
      const triggerValidation = validateAutoResponse({ 
        trigger: updates.trigger, 
        response: autoResponse.response 
      });
      if (!triggerValidation.isValid) {
        throw new Error(triggerValidation.error);
      }

      // Check for duplicate trigger (excluding current)
      const existingResponse = this.autoResponses.find(
        ar => ar.trigger.toLowerCase() === triggerValidation.trigger.toLowerCase() && 
             ar._id.toString() !== responseId
      );
      if (existingResponse) {
        throw new Error(ERROR_MESSAGES.TRIGGER_ALREADY_EXISTS);
      }

      autoResponse.trigger = triggerValidation.trigger;
    }

    if (updates.response) {
      const responseValidation = validateAutoResponse({ 
        trigger: autoResponse.trigger, 
        response: updates.response 
      });
      if (!responseValidation.isValid) {
        throw new Error(responseValidation.error);
      }
      autoResponse.response = responseValidation.response;
    }

    if (updates.isActive !== undefined) autoResponse.isActive = updates.isActive;
    if (updates.priority !== undefined) autoResponse.priority = updates.priority;
    if (updates.matchType) autoResponse.matchType = updates.matchType;

    autoResponse.updatedAt = new Date();
    
    // Re-sort by priority
    this.autoResponses.sort((a, b) => b.priority - a.priority);
    
    await this.save();

    return autoResponse;
  };

  // Delete auto response
  schema.methods.deleteAutoResponse = async function(responseId) {
    const autoResponse = this.autoResponses.id(responseId);
    if (!autoResponse) {
      throw new Error('Auto response not found');
    }

    autoResponse.remove();
    await this.save();

    return true;
  };

  // Process incoming message
  schema.methods.processMessage = async function(message, variables = {}) {
    this.stats.messagesSent += 1;
    
    // Check for auto response
    const matchingResponse = findMatchingAutoResponse(this.autoResponses, message);
    if (matchingResponse && matchingResponse.isActive) {
      this.stats.autoResponsesTriggered += 1;
      await this.save();
      
      return {
        type: 'auto_response',
        response: matchingResponse.response,
        trigger: matchingResponse.trigger
      };
    }

    return {
      type: 'no_match',
      response: null
    };
  };

  // Render template by name
  schema.methods.renderTemplate = async function(templateName, variables = {}) {
    const template = this.templates.find(
      t => t.name.toLowerCase() === templateName.toLowerCase() && t.isActive
    );

    if (!template) {
      throw new Error(ERROR_MESSAGES.TEMPLATE_NOT_FOUND);
    }

    this.stats.templatesUsed += 1;
    await this.save();

    return {
      name: template.name,
      message: renderTemplate(template.message, variables),
      variables: template.variables
    };
  };

  // Update business profile
  schema.methods.updateBusinessProfile = async function(profileData) {
    this.businessProfile = {
      ...this.businessProfile,
      ...profileData
    };
    
    await this.save();
    return this.businessProfile;
  };

  // Configure webhook
  schema.methods.configureWebhook = async function(url, secret) {
    this.webhook = {
      url,
      secret,
      isActive: true
    };
    
    await this.save();
    return this.webhook;
  };

  // Disable webhook
  schema.methods.disableWebhook = async function() {
    if (this.webhook) {
      this.webhook.isActive = false;
      await this.save();
    }
    return this.webhook;
  };

  // Get template by name
  schema.methods.getTemplate = function(templateName) {
    return this.templates.find(
      t => t.name.toLowerCase() === templateName.toLowerCase()
    );
  };

  // Get all active templates
  schema.methods.getActiveTemplates = function() {
    return this.templates.filter(t => t.isActive);
  };

  // Get templates by category
  schema.methods.getTemplatesByCategory = function(category) {
    return this.templates.filter(t => t.category === category);
  };
};