import assistantService from '../services/assistantService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

/**
 * @desc    Process user question and return grounded ownership intelligence response
 * @route   POST /api/v1/assistant/chat
 * @access  Private
 */
export const chatWithAssistant = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { message, sessionId, productId } = req.body;

    if (!message || !message.trim()) {
      return sendError(res, 'Message text is required', 400);
    }

    const result = await assistantService.processUserMessage({
      userId,
      message,
      sessionId,
      productId,
    });

    return sendSuccess(res, result, 'Assistant response generated successfully');
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Get conversation message history for authenticated user
 * @route   GET /api/v1/assistant/history
 * @access  Private
 */
export const getAssistantHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { sessionId } = req.query;

    const messages = await assistantService.getConversationHistory(userId, sessionId);
    return sendSuccess(res, { messages }, 'Conversation history retrieved successfully');
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Clear conversation history for authenticated user
 * @route   DELETE /api/v1/assistant/history
 * @access  Private
 */
export const clearAssistantHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { sessionId } = req.query;

    const result = await assistantService.clearConversationHistory(userId, sessionId);
    return sendSuccess(res, result, 'Conversation history cleared successfully');
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};
