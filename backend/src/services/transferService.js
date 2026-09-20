import OwnershipTransfer from '../models/OwnershipTransfer.js';
import OwnershipHistory from '../models/OwnershipHistory.js';
import Product from '../models/Product.js';
import Document from '../models/Document.js';
import User from '../models/User.js';
import PassportShare from '../models/PassportShare.js';
import timelineService from './timelineService.js';
import alertService from './alertService.js';
import securityAuditService from './securityAuditService.js';
import { formatDateIN } from '../utils/formatters.js';

class TransferService {
  /**
   * Initiate an ownership transfer of a registered product to a recipient email.
   */
  async initiateTransfer(arg1, arg2 = {}) {
    const params = typeof arg1 === 'object' && arg1.fromUserId ? arg1 : { fromUserId: arg1, ...arg2 };
    const { fromUserId, productId, recipientEmail, notes = '' } = params;

    if (!productId || !recipientEmail || !recipientEmail.trim()) {
      const err = new Error('Product ID and recipient email are required');
      err.statusCode = 400;
      throw err;
    }

    const cleanEmail = recipientEmail.trim().toLowerCase();

    // Verify product exists and is owned by caller
    const product = await Product.findOne({ _id: productId, userId: fromUserId });
    if (!product) {
      const err = new Error('Product not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    if (product.status === 'Disposed') {
      const err = new Error('Cannot transfer a disposed product');
      err.statusCode = 400;
      throw err;
    }

    const fromUser = await User.findById(fromUserId);
    if (fromUser && fromUser.email.toLowerCase() === cleanEmail) {
      const err = new Error('Cannot transfer product to yourself');
      err.statusCode = 400;
      throw err;
    }

    // Auto-expire any stale pending transfers for this product
    const now = new Date();
    await OwnershipTransfer.updateMany(
      { productId, status: 'PENDING', expiresAt: { $lt: now } },
      { status: 'EXPIRED' }
    );

    // Check if an active pending transfer already exists
    const activeExisting = await OwnershipTransfer.findOne({
      productId,
      status: 'PENDING',
      expiresAt: { $gte: now },
    });

    if (activeExisting) {
      const err = new Error(
        `An ownership transfer is already pending for this product to ${activeExisting.recipientEmail}`
      );
      err.statusCode = 400;
      throw err;
    }

    // Check if recipient is already registered
    const recipientUser = await User.findOne({ email: cleanEmail });

    // Create OwnershipTransfer record
    const transfer = await OwnershipTransfer.create({
      productId,
      fromUserId,
      toUserId: recipientUser ? recipientUser._id : null,
      recipientEmail: cleanEmail,
      status: 'PENDING',
      initiatedAt: now,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days expiration
      notes: notes.trim(),
    });

    // Update product status
    product.status = 'Transfer Pending';
    await product.save();

    // Record initial OwnershipHistory for original owner if not yet created
    const existingHistory = await OwnershipHistory.findOne({
      productId,
      ownerUserId: fromUserId,
      endedAt: null,
    });
    if (!existingHistory) {
      await OwnershipHistory.create({
        productId,
        ownerUserId: fromUserId,
        ownerEmail: fromUser.email,
        ownerName: fromUser.name,
        startedAt: product.purchaseDate || product.createdAt || now,
        source: 'PURCHASE',
      });
    }

    // Record Timeline Event on product
    try {
      await timelineService.recordEvent({
        userId: fromUserId,
        productId,
        eventType: 'TRANSFER_INITIATED',
        title: 'Ownership Transfer Initiated',
        description: `Transfer invitation sent to ${cleanEmail}. Pending recipient acceptance until ${formatDateIN(
          transfer.expiresAt
        )}.`,
        source: 'USER',
        metadata: {
          transferId: String(transfer._id),
          recipientEmail: cleanEmail,
        },
      });
    } catch (tErr) {
      console.warn('[Timeline Warning] Failed to log transfer initiation event:', tErr.message);
    }

    // Send Alert to recipient if registered
    if (recipientUser) {
      try {
        await alertService.createAlert({
          userId: recipientUser._id,
          productId: product._id,
          type: 'OWNERSHIP_TRANSFER',
          title: 'Incoming Ownership Transfer',
          message: `${fromUser.name} (${fromUser.email}) has invited you to receive ownership of "${product.productName}".`,
          priority: 'HIGH',
        });
      } catch (aErr) {
        console.warn('[Alert Warning] Failed to send incoming transfer alert:', aErr.message);
      }
    }

    await securityAuditService.logEvent({
      userId: fromUserId,
      email: fromUser?.email,
      action: 'TRANSFER_INITIATE',
      status: 'SUCCESS',
      details: {
        transferId: transfer._id,
        productId: product._id,
        recipientEmail: cleanEmail,
      },
    });

    return await OwnershipTransfer.findById(transfer._id)
      .populate('productId', 'productName category brand model purchasePrice currency')
      .populate('fromUserId', 'name email')
      .lean();
  }

  /**
   * Retrieve incoming pending transfers for the authenticated user.
   */
  async getIncomingTransfers(arg1, arg2) {
    let userEmail, userId;
    if (typeof arg1 === 'object') {
      userEmail = arg1.email || arg1.userEmail;
      userId = arg1.userId || arg1.id;
    } else {
      userEmail = arg1;
      userId = arg2;
    }
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    const now = new Date();

    // Auto-expire past-due transfers
    await OwnershipTransfer.updateMany(
      {
        $or: [{ recipientEmail: cleanEmail }, { toUserId: userId }],
        status: 'PENDING',
        expiresAt: { $lt: now },
      },
      { status: 'EXPIRED' }
    );

    const transfers = await OwnershipTransfer.find({
      $or: [{ recipientEmail: cleanEmail }, { toUserId: userId }],
      status: 'PENDING',
      expiresAt: { $gte: now },
    })
      .populate('productId', 'productName category brand model purchasePrice currency warranty returnInfo')
      .populate('fromUserId', 'name email')
      .sort({ initiatedAt: -1 })
      .lean();

    return transfers;
  }

  /**
   * Retrieve outgoing pending transfers initiated by the authenticated user.
   */
  async getOutgoingTransfers(arg) {
    let userId;
    if (arg && typeof arg === 'object' && (arg.userId || arg.fromUserId)) {
      userId = arg.userId || arg.fromUserId;
    } else {
      userId = arg;
    }
    const now = new Date();

    // Auto-expire
    await OwnershipTransfer.updateMany(
      { fromUserId: userId, status: 'PENDING', expiresAt: { $lt: now } },
      { status: 'EXPIRED' }
    );

    const transfers = await OwnershipTransfer.find({
      fromUserId: userId,
      status: 'PENDING',
      expiresAt: { $gte: now },
    })
      .populate('productId', 'productName category brand model purchasePrice currency status')
      .sort({ initiatedAt: -1 })
      .lean();

    return transfers;
  }

  /**
   * Retrieve historical transfers (ACCEPTED, REJECTED, CANCELLED, EXPIRED).
   */
  async getTransferHistory(arg1, arg2) {
    let userId, userEmail;
    if (typeof arg1 === 'object') {
      userId = arg1.userId || arg1.id;
      userEmail = arg1.email || arg1.userEmail;
    } else {
      userId = arg1;
      userEmail = arg2;
    }
    const cleanEmail = (userEmail || '').trim().toLowerCase();

    const history = await OwnershipTransfer.find({
      $or: [
        { fromUserId: userId },
        { toUserId: userId },
        { recipientEmail: cleanEmail },
      ],
      status: { $ne: 'PENDING' },
    })
      .populate('productId', 'productName category brand model')
      .populate('fromUserId', 'name email')
      .populate('toUserId', 'name email')
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    return history;
  }

  /**
   * Recipient accepts incoming ownership transfer.
   * Atomically transfers product ownership, closes previous owner history,
   * links documents, and updates status.
   */
  async acceptTransfer(arg1, arg2, arg3) {
    let transferId, toUserId, userEmail, transferToken;
    if (typeof arg1 === 'object') {
      transferId = arg1.transferId;
      toUserId = arg1.toUserId;
      userEmail = arg1.userEmail || arg1.email;
      transferToken = arg1.transferToken;
    } else {
      toUserId = arg1;
      userEmail = arg2;
      transferId = arg3;
    }
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    const now = new Date();

    const transfer = await OwnershipTransfer.findById(transferId);
    if (!transfer) {
      const err = new Error('Transfer record not found');
      err.statusCode = 404;
      throw err;
    }

    if (transfer.status !== 'PENDING') {
      const err = new Error(`Transfer cannot be accepted (current status: ${transfer.status})`);
      err.statusCode = 400;
      throw err;
    }

    if (now > new Date(transfer.expiresAt)) {
      transfer.status = 'EXPIRED';
      await transfer.save();
      const err = new Error('Transfer invitation has expired');
      err.statusCode = 400;
      throw err;
    }

    if (transferToken && transfer.transferToken !== transferToken.trim()) {
      const err = new Error('Invalid transfer handshake token');
      err.statusCode = 400;
      throw err;
    }

    // Security check: Must be intended recipient
    const isRecipient =
      transfer.recipientEmail === cleanEmail ||
      (transfer.toUserId && String(transfer.toUserId) === String(toUserId));

    if (!isRecipient) {
      const err = new Error('Access denied: You are not the intended recipient of this transfer');
      err.statusCode = 403;
      throw err;
    }

    // Verify product is still with original owner
    const product = await Product.findById(transfer.productId);
    if (!product || String(product.userId) !== String(transfer.fromUserId)) {
      const err = new Error('Product is no longer available with the original owner');
      err.statusCode = 400;
      throw err;
    }

    const fromUser = await User.findById(transfer.fromUserId);
    const toUser = await User.findById(toUserId);

    // 1. Atomically transfer product
    product.userId = toUserId;
    product.status = 'Active';
    product.transferredAt = now;
    if (!product.originalPurchaseDate) {
      product.originalPurchaseDate = product.purchaseDate;
    }
    if (!product.originalSeller) {
      product.originalSeller = product.sellerName;
    }
    await product.save();

    // 2. Update OwnershipHistory chain of custody
    await OwnershipHistory.findOneAndUpdate(
      { productId: product._id, ownerUserId: transfer.fromUserId, endedAt: null },
      { endedAt: now }
    );

    await OwnershipHistory.create({
      productId: product._id,
      ownerUserId: toUserId,
      ownerEmail: toUser.email,
      ownerName: toUser.name,
      startedAt: now,
      source: 'TRANSFER',
      transferId: transfer._id,
    });

    // 3. Transfer product-associated documents to new owner
    await Document.updateMany(
      { productId: product._id, userId: transfer.fromUserId },
      { userId: toUserId }
    );

    // 4. Revoke active passport share links created by previous owner
    await PassportShare.updateMany(
      { productId: product._id, userId: transfer.fromUserId, revokedAt: null },
      { revokedAt: now }
    );

    // 5. Mark transfer as ACCEPTED
    transfer.status = 'ACCEPTED';
    transfer.acceptedAt = now;
    transfer.toUserId = toUserId;
    await transfer.save();

    // 5. Timeline Events
    try {
      // Recipient timeline event
      await timelineService.recordEvent({
        userId: toUserId,
        productId: product._id,
        eventType: 'TRANSFER_ACCEPTED',
        title: 'Product Ownership Received',
        description: `Transferred ownership from ${fromUser.name} (${fromUser.email}).`,
        source: 'SYSTEM',
        metadata: { transferId: String(transfer._id), fromUser: fromUser.email },
      });

      // Sender timeline event
      await timelineService.recordEvent({
        userId: transfer.fromUserId,
        productId: product._id,
        eventType: 'OWNERSHIP_TRANSFER',
        title: 'Ownership Transferred',
        description: `Successfully transferred ownership to ${toUser.name} (${toUser.email}).`,
        source: 'SYSTEM',
        metadata: { transferId: String(transfer._id), toUser: toUser.email },
      });
    } catch (tErr) {
      console.warn('[Timeline Warning] Failed to log transfer acceptance timeline event:', tErr.message);
    }

    // 6. Notifications
    try {
      // Alert to sender
      await alertService.createAlert({
        userId: transfer.fromUserId,
        productId: product._id,
        type: 'OWNERSHIP_TRANSFER',
        title: 'Ownership Transfer Completed',
        message: `${toUser.name} has accepted ownership of "${product.productName}".`,
        priority: 'INFO',
      });

      // Alert to recipient
      await alertService.createAlert({
        userId: toUserId,
        productId: product._id,
        type: 'OWNERSHIP_TRANSFER',
        title: 'Product Ownership Active',
        message: `You are now the verified owner of "${product.productName}".`,
        priority: 'INFO',
      });
    } catch (aErr) {
      console.warn('[Alert Warning] Failed to dispatch transfer alerts:', aErr.message);
    }

    await securityAuditService.logEvent({
      userId: toUserId,
      email: toUser?.email,
      action: 'TRANSFER_ACCEPT',
      status: 'SUCCESS',
      details: {
        transferId: transfer._id,
        productId: product._id,
        fromUserId: transfer.fromUserId,
      },
    });

    return {
      success: true,
      transfer,
      product,
    };
  }

  /**
   * Recipient rejects an incoming ownership transfer.
   */
  async rejectTransfer(arg1, arg2, arg3, arg4) {
    let toUserId, userEmail, transferId, reason;
    if (typeof arg1 === 'object') {
      transferId = arg1.transferId || arg1.id;
      toUserId = arg1.toUserId || arg1.userId;
      userEmail = arg1.userEmail || arg1.email;
      reason = arg1.reason;
    } else {
      toUserId = arg1;
      userEmail = arg2;
      transferId = arg3;
      reason = arg4;
    }

    const cleanEmail = (userEmail || '').trim().toLowerCase();
    const now = new Date();

    const transfer = await OwnershipTransfer.findById(transferId);
    if (!transfer) {
      const err = new Error('Transfer record not found');
      err.statusCode = 404;
      throw err;
    }

    if (transfer.status !== 'PENDING') {
      const err = new Error(`Transfer cannot be rejected (current status: ${transfer.status})`);
      err.statusCode = 400;
      throw err;
    }

    const isRecipient =
      transfer.recipientEmail === cleanEmail ||
      (transfer.toUserId && String(transfer.toUserId) === String(toUserId));

    if (!isRecipient) {
      const err = new Error('Access denied: You are not the intended recipient of this transfer');
      err.statusCode = 403;
      throw err;
    }

    transfer.status = 'REJECTED';
    transfer.rejectedAt = now;
    if (reason) {
      transfer.notes = transfer.notes ? `${transfer.notes} [Rejected reason: ${reason}]` : `Rejected reason: ${reason}`;
    }
    await transfer.save();

    // Reset product status
    const product = await Product.findById(transfer.productId);
    if (product && product.status === 'Transfer Pending') {
      product.status = 'Active';
      await product.save();
    }

    // Notify original owner
    try {
      await alertService.createAlert({
        userId: transfer.fromUserId,
        productId: transfer.productId,
        type: 'OWNERSHIP_TRANSFER',
        title: 'Ownership Transfer Declined',
        message: `Your transfer invitation for "${product?.productName || 'product'}" was declined.`,
        priority: 'INFO',
      });
    } catch (aErr) {
      console.warn('[Alert Warning] Failed to send rejection alert:', aErr.message);
    }

    await securityAuditService.logEvent({
      userId: toUserId,
      email: cleanEmail,
      action: 'TRANSFER_REJECT',
      status: 'SUCCESS',
      details: {
        transferId: transfer._id,
        productId: transfer.productId,
        reason,
      },
    });

    return { rejected: true, transfer };
  }

  /**
   * Sender cancels a pending ownership transfer.
   */
  async cancelTransfer(arg1, arg2) {
    let fromUserId, transferId;
    if (typeof arg1 === 'object') {
      transferId = arg1.transferId || arg1.id;
      fromUserId = arg1.fromUserId || arg1.userId;
    } else {
      fromUserId = arg1;
      transferId = arg2;
    }

    const transfer = await OwnershipTransfer.findOne({
      _id: transferId,
      fromUserId,
    });

    if (!transfer) {
      const err = new Error('Transfer record not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    if (transfer.status !== 'PENDING') {
      const err = new Error(`Only pending transfers can be cancelled (current status: ${transfer.status})`);
      err.statusCode = 400;
      throw err;
    }

    transfer.status = 'CANCELLED';
    transfer.cancelledAt = new Date();
    await transfer.save();

    // Reset product status
    const product = await Product.findById(transfer.productId);
    if (product && product.status === 'Transfer Pending') {
      product.status = 'Active';
      await product.save();
    }

    await securityAuditService.logEvent({
      userId: fromUserId,
      action: 'TRANSFER_CANCEL',
      status: 'SUCCESS',
      details: {
        transferId: transfer._id,
        productId: transfer.productId,
      },
    });

    return { cancelled: true, transfer };
  }
}

export default new TransferService();
