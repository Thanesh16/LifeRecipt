import transferService from '../services/transferService.js';
import { sendSuccess } from '../utils/responseHandler.js';

export const initiateTransfer = async (req, res, next) => {
  try {
    const { productId, recipientEmail, notes } = req.body;
    const transfer = await transferService.initiateTransfer({
      fromUserId: req.user._id,
      productId,
      recipientEmail,
      notes,
    });
    sendSuccess(res, transfer, 'Ownership transfer initiated successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const getIncomingTransfers = async (req, res, next) => {
  try {
    const transfers = await transferService.getIncomingTransfers({
      userId: req.user._id,
      email: req.user.email,
    });
    sendSuccess(res, transfers, 'Incoming transfers retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const getOutgoingTransfers = async (req, res, next) => {
  try {
    const transfers = await transferService.getOutgoingTransfers(req.user._id);
    sendSuccess(res, transfers, 'Outgoing transfers retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const getTransferHistory = async (req, res, next) => {
  try {
    const history = await transferService.getTransferHistory({
      userId: req.user._id,
      email: req.user.email,
    });
    sendSuccess(res, history, 'Transfer history retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const acceptTransfer = async (req, res, next) => {
  try {
    const { transferId } = req.params;
    const { transferToken } = req.body;
    const result = await transferService.acceptTransfer({
      transferId,
      toUserId: req.user._id,
      userEmail: req.user.email,
      transferToken,
    });
    sendSuccess(res, result, 'Ownership transfer accepted successfully');
  } catch (err) {
    next(err);
  }
};

export const rejectTransfer = async (req, res, next) => {
  try {
    const { transferId } = req.params;
    const { reason } = req.body;
    const result = await transferService.rejectTransfer({
      transferId,
      userId: req.user._id,
      userEmail: req.user.email,
      reason,
    });
    sendSuccess(res, result, 'Ownership transfer rejected');
  } catch (err) {
    next(err);
  }
};

export const cancelTransfer = async (req, res, next) => {
  try {
    const { transferId } = req.params;
    const result = await transferService.cancelTransfer({
      transferId,
      fromUserId: req.user._id,
    });
    sendSuccess(res, result, 'Ownership transfer cancelled successfully');
  } catch (err) {
    next(err);
  }
};
