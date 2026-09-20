import mongoose from 'mongoose';
import ServiceRecord from '../models/ServiceRecord.js';
import Product from '../models/Product.js';
import Expense from '../models/Expense.js';
import Document from '../models/Document.js';
import Alert from '../models/Alert.js';
import timelineService from './timelineService.js';
import { formatINR, formatDateIN } from '../utils/formatters.js';

/**
 * LIFERECEIPT ServiceRecord Service
 * Phase 13: Warranty & Service Ecosystem
 * 
 * Manages service logs, repair jobs, maintenance entries,
 * duplicate-free expense integration, timeline events, and alert notifications.
 */
class ServiceRecordService {
  /**
   * Create a new service record
   */
  async createServiceRecord({
    userId,
    productId,
    serviceType = 'REPAIR',
    status = 'REQUESTED',
    serviceProvider = '',
    serviceCenterName = '',
    serviceCenterAddress = '',
    serviceCenterPhone = '',
    serviceCenterUrl = '',
    issueTitle,
    issueDescription = '',
    reportedDate = new Date(),
    scheduledDate = null,
    completedDate = null,
    warrantyRelated = false,
    warrantyClaimReference = '',
    estimatedCost = 0,
    actualCost = 0,
    currency = 'INR',
    relatedDocumentIds = [],
    notes = '',
    source = 'USER',
  }) {
    if (!userId) throw new Error('User ID is required');
    if (!productId) throw new Error('Product ID is required');
    if (!issueTitle || !issueTitle.trim()) throw new Error('Issue title is required');

    // 1. Verify product ownership
    const product = await Product.findOne({ _id: productId, userId });
    if (!product) {
      const err = new Error('Product not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    // 2. Validate costs and dates
    const cleanEstimatedCost = Math.max(0, Number(estimatedCost) || 0);
    const cleanActualCost = Math.max(0, Number(actualCost) || 0);
    const repDate = reportedDate ? new Date(reportedDate) : new Date();
    const schedDate = scheduledDate ? new Date(scheduledDate) : null;
    const compDate = completedDate ? new Date(completedDate) : null;

    if (isNaN(repDate.getTime())) {
      throw new Error('Invalid reported date provided');
    }

    // 3. Verify documents belong to authenticated user
    let validDocIds = [];
    if (Array.isArray(relatedDocumentIds) && relatedDocumentIds.length > 0) {
      const docs = await Document.find({
        _id: { $in: relatedDocumentIds },
        userId,
      }).select('_id');
      validDocIds = docs.map((d) => d._id);
    }

    // 4. Create ServiceRecord
    const serviceRecord = await ServiceRecord.create({
      userId,
      productId,
      serviceType,
      status,
      serviceProvider: (serviceProvider || '').trim(),
      serviceCenterName: (serviceCenterName || '').trim(),
      serviceCenterAddress: (serviceCenterAddress || '').trim(),
      serviceCenterPhone: (serviceCenterPhone || '').trim(),
      serviceCenterUrl: (serviceCenterUrl || '').trim(),
      issueTitle: issueTitle.trim(),
      issueDescription: (issueDescription || '').trim(),
      reportedDate: repDate,
      scheduledDate: schedDate,
      completedDate: compDate,
      warrantyRelated: Boolean(warrantyRelated),
      warrantyClaimReference: (warrantyClaimReference || '').trim(),
      estimatedCost: cleanEstimatedCost,
      actualCost: cleanActualCost,
      currency: 'INR',
      relatedDocumentIds: validDocIds,
      notes: (notes || '').trim(),
      source,
    });

    // 5. If service completed with cost > 0, create linked expense (preventing duplicate counting)
    if (status === 'COMPLETED' && cleanActualCost > 0) {
      await this._syncLinkedExpense(serviceRecord, product);
    }

    // 6. Record timeline event
    await this._recordServiceTimelineEvent(serviceRecord, product, status);

    // 7. Generate service alert if scheduled
    if (status === 'SCHEDULED' && schedDate) {
      await this._createScheduledAlert(serviceRecord, product);
    }

    return serviceRecord;
  }

  /**
   * Get user's service records with filtering and counts
   */
  async getServiceRecords({
    userId,
    productId = null,
    status = null,
    serviceType = null,
    tab = 'all',
    page = 1,
    limit = 20,
  }) {
    const filter = { userId };
    if (productId) filter.productId = productId;

    // Handle tab filters
    switch (tab.toLowerCase()) {
      case 'active':
      case 'in_progress':
        filter.status = { $in: ['REQUESTED', 'SCHEDULED', 'IN_SERVICE', 'WAITING_FOR_PARTS'] };
        break;
      case 'completed':
        filter.status = 'COMPLETED';
        break;
      case 'warranty_claims':
        filter.$or = [{ serviceType: 'WARRANTY_CLAIM' }, { warrantyRelated: true }];
        break;
      case 'all':
      default:
        if (status) filter.status = status;
        if (serviceType) filter.serviceType = serviceType;
        break;
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const parsedLimit = Math.max(1, parseInt(limit, 10));

    const [records, total, counts] = await Promise.all([
      ServiceRecord.find(filter)
        .sort({ reportedDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .populate('productId', 'productName brand model serialNumber category purchasePrice')
        .populate('relatedDocumentIds', 'fileName fileSize mimeType documentType')
        .populate('relatedExpenseId', 'amount currency expenseType title')
        .lean(),
      ServiceRecord.countDocuments(filter),
      this._getServiceCounts(userId, productId),
    ]);

    return {
      records,
      pagination: {
        total,
        page: parseInt(page, 10),
        pages: Math.ceil(total / parsedLimit) || 1,
        limit: parsedLimit,
      },
      counts,
    };
  }

  /**
   * Get single service record details
   */
  async getServiceRecordById(arg1, arg2) {
    let record = await ServiceRecord.findOne({ _id: arg2, userId: arg1 })
      .populate('productId', 'productName brand model serialNumber category purchasePrice warranty')
      .populate('relatedDocumentIds', 'fileName fileSize mimeType documentType storagePath')
      .populate('relatedExpenseId')
      .lean();

    if (!record) {
      record = await ServiceRecord.findOne({ _id: arg1, userId: arg2 })
        .populate('productId', 'productName brand model serialNumber category purchasePrice warranty')
        .populate('relatedDocumentIds', 'fileName fileSize mimeType documentType storagePath')
        .populate('relatedExpenseId')
        .lean();
    }

    if (!record) {
      const err = new Error('Service record not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    return record;
  }

  /**
   * Update an existing service record
   */
  async updateServiceRecord(arg1, arg2, updates = {}) {
    let record = await ServiceRecord.findOne({ _id: arg2, userId: arg1 });
    let userId = arg1;
    let serviceId = arg2;

    if (!record) {
      record = await ServiceRecord.findOne({ _id: arg1, userId: arg2 });
      userId = arg2;
      serviceId = arg1;
    }

    if (!record) {
      const err = new Error('Service record not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    const product = await Product.findOne({ _id: record.productId, userId });
    const prevStatus = record.status;

    // Apply allowed fields
    if (updates.serviceType !== undefined) record.serviceType = updates.serviceType;
    if (updates.status !== undefined) record.status = updates.status;
    if (updates.serviceProvider !== undefined) record.serviceProvider = updates.serviceProvider.trim();
    if (updates.serviceCenterName !== undefined) record.serviceCenterName = updates.serviceCenterName.trim();
    if (updates.serviceCenterAddress !== undefined) record.serviceCenterAddress = updates.serviceCenterAddress.trim();
    if (updates.serviceCenterPhone !== undefined) record.serviceCenterPhone = updates.serviceCenterPhone.trim();
    if (updates.serviceCenterUrl !== undefined) record.serviceCenterUrl = updates.serviceCenterUrl.trim();
    if (updates.issueTitle !== undefined && updates.issueTitle.trim()) record.issueTitle = updates.issueTitle.trim();
    if (updates.issueDescription !== undefined) record.issueDescription = updates.issueDescription.trim();
    if (updates.notes !== undefined) record.notes = updates.notes.trim();
    if (updates.warrantyRelated !== undefined) record.warrantyRelated = Boolean(updates.warrantyRelated);
    if (updates.warrantyClaimReference !== undefined) record.warrantyClaimReference = updates.warrantyClaimReference.trim();

    if (updates.reportedDate) record.reportedDate = new Date(updates.reportedDate);
    if (updates.scheduledDate !== undefined) {
      record.scheduledDate = updates.scheduledDate ? new Date(updates.scheduledDate) : null;
    }
    if (updates.completedDate !== undefined) {
      record.completedDate = updates.completedDate ? new Date(updates.completedDate) : null;
    }

    if (updates.estimatedCost !== undefined) {
      record.estimatedCost = Math.max(0, Number(updates.estimatedCost) || 0);
    }
    if (updates.actualCost !== undefined) {
      record.actualCost = Math.max(0, Number(updates.actualCost) || 0);
    }

    if (Array.isArray(updates.relatedDocumentIds)) {
      const validDocs = await Document.find({
        _id: { $in: updates.relatedDocumentIds },
        userId,
      }).select('_id');
      record.relatedDocumentIds = validDocs.map((d) => d._id);
    }

    // Auto-set completedDate if marked completed and not explicitly provided
    if (record.status === 'COMPLETED' && !record.completedDate) {
      record.completedDate = new Date();
    }

    await record.save();

    // Sync expense linkage
    if (record.status === 'COMPLETED' && record.actualCost > 0) {
      await this._syncLinkedExpense(record, product);
    } else if (record.relatedExpenseId && (record.status === 'CANCELLED' || record.actualCost === 0)) {
      // Remove or zero out linked expense if cancelled
      await Expense.deleteOne({ _id: record.relatedExpenseId, userId });
      record.relatedExpenseId = null;
      await record.save();
    }

    // Log timeline event on status change
    if (updates.status && updates.status !== prevStatus && product) {
      await this._recordServiceTimelineEvent(record, product, record.status);
    }

    return record;
  }

  /**
   * Delete a service record and clean up associated expense
   */
  async deleteServiceRecord(arg1, arg2) {
    let record = await ServiceRecord.findOne({ _id: arg2, userId: arg1 });
    let userId = arg1;
    let serviceId = arg2;
    if (!record) {
      record = await ServiceRecord.findOne({ _id: arg1, userId: arg2 });
      userId = arg2;
      serviceId = arg1;
    }
    if (!record) {
      const err = new Error('Service record not found or access denied');
      err.statusCode = 404;
      throw err;
    }

    // Clean up linked expense if any
    if (record.relatedExpenseId) {
      await Expense.deleteOne({ _id: record.relatedExpenseId, userId });
    }

    await ServiceRecord.deleteOne({ _id: serviceId, userId });
    return { deleted: true, serviceId };
  }

  /**
   * Calculate service cost analytics without double counting
   */
  async getServiceCostSummary(userId, productId = null) {
    const filter = { userId, status: 'COMPLETED' };
    if (productId) filter.productId = new mongoose.Types.ObjectId(productId);

    const matchStage = {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        status: 'COMPLETED',
      },
    };
    if (productId) {
      matchStage.$match.productId = new mongoose.Types.ObjectId(productId);
    }

    const aggregation = await ServiceRecord.aggregate([
      matchStage,
      {
        $group: {
          _id: '$serviceType',
          totalCost: { $sum: '$actualCost' },
          count: { $sum: 1 },
        },
      },
    ]);

    let totalServiceCost = 0;
    let totalRepairCost = 0;
    let totalMaintenanceCost = 0;
    let serviceCount = 0;
    let repairCount = 0;
    let maintenanceCount = 0;

    for (const group of aggregation) {
      totalServiceCost += group.totalCost;
      serviceCount += group.count;

      if (group._id === 'REPAIR') {
        totalRepairCost += group.totalCost;
        repairCount += group.count;
      } else if (group._id === 'MAINTENANCE') {
        totalMaintenanceCost += group.totalCost;
        maintenanceCount += group.count;
      }
    }

    // Fetch latest service
    const latestService = await ServiceRecord.findOne(filter)
      .sort({ completedDate: -1, reportedDate: -1 })
      .lean();

    return {
      totalServiceCost,
      totalRepairCost,
      totalMaintenanceCost,
      serviceCount,
      repairCount,
      maintenanceCount,
      latestServiceDate: latestService?.completedDate || latestService?.reportedDate || null,
      latestServiceTitle: latestService?.issueTitle || null,
    };
  }

  /**
   * Get complete service analytics including status counts
   */
  async getServiceStats(userId, productId = null) {
    const summary = await this.getServiceCostSummary(userId, productId);
    const filter = { userId };
    if (productId) filter.productId = productId;

    const totalRecords = await ServiceRecord.countDocuments(filter);
    const records = await ServiceRecord.find(filter).lean();
    const byStatus = {};
    records.forEach((r) => {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    });

    return {
      ...summary,
      totalCost: summary.totalServiceCost,
      totalRecords,
      byStatus,
    };
  }

  /**
   * Automated Service History Analysis (Phase 17)
   * Detects patterns across repair history:
   * - Repeated repairs on same product
   * - High cumulative spend exceeding replacement threshold (>50% of purchase price)
   * - Recurring defect keywords (battery, screen, hinge, motherboard, charging, etc.)
   * - Turnaround time and service frequency
   * - Actionable recommendations
   */
  async getServiceHistoryAnalysis(userId, productId = null) {
    const filter = { userId };
    if (productId) filter.productId = productId;

    const records = await ServiceRecord.find(filter)
      .populate('productId', 'productName brand model purchasePrice category purchaseDate')
      .sort({ reportedDate: 1 })
      .lean();

    const DEFECT_KEYWORDS = [
      'battery', 'screen', 'display', 'panel', 'hinge', 'motherboard', 'logic board',
      'charging', 'charger', 'port', 'fan', 'cooling', 'overheating', 'keyboard',
      'speaker', 'audio', 'sensor', 'camera', 'power', 'motor', 'compressor',
      'leak', 'software', 'crash', 'freeze', 'wifi', 'bluetooth', 'trackpad', 'mouse'
    ];

    // Group by product
    const productMap = new Map();
    let totalServiceCost = 0;
    let totalRepairs = 0;
    let totalMaintenance = 0;
    let completedTurnaroundDays = [];

    records.forEach((rec) => {
      const prod = rec.productId || { _id: 'unknown', productName: 'Unlinked Item', purchasePrice: 0 };
      const prodIdStr = String(prod._id);

      if (!productMap.has(prodIdStr)) {
        productMap.set(prodIdStr, {
          productId: prod._id,
          productName: prod.productName || 'Unknown Product',
          brand: prod.brand || '',
          model: prod.model || '',
          category: prod.category || '',
          purchasePrice: prod.purchasePrice || 0,
          purchaseDate: prod.purchaseDate || null,
          totalRecords: 0,
          repairsCount: 0,
          maintenanceCount: 0,
          completedCount: 0,
          totalActualCost: 0,
          records: [],
          defectKeywordCounts: {},
          turnaroundDays: [],
        });
      }

      const pEntry = productMap.get(prodIdStr);
      pEntry.totalRecords += 1;
      pEntry.totalActualCost += rec.actualCost || 0;
      totalServiceCost += rec.actualCost || 0;

      if (rec.serviceType === 'REPAIR' || rec.serviceType === 'REPLACEMENT') {
        pEntry.repairsCount += 1;
        totalRepairs += 1;
      } else if (rec.serviceType === 'MAINTENANCE' || rec.serviceType === 'INSPECTION') {
        pEntry.maintenanceCount += 1;
        totalMaintenance += 1;
      }

      if (rec.status === 'COMPLETED') {
        pEntry.completedCount += 1;
        if (rec.reportedDate && rec.completedDate) {
          const days = Math.max(0, Math.round((new Date(rec.completedDate) - new Date(rec.reportedDate)) / (1000 * 60 * 60 * 24)));
          pEntry.turnaroundDays.push(days);
          completedTurnaroundDays.push(days);
        }
      }

      // Keyword scanning on issue title and description
      const textToScan = `${rec.issueTitle || ''} ${rec.issueDescription || ''}`.toLowerCase();
      DEFECT_KEYWORDS.forEach((kw) => {
        if (textToScan.includes(kw)) {
          pEntry.defectKeywordCounts[kw] = (pEntry.defectKeywordCounts[kw] || 0) + 1;
        }
      });

      pEntry.records.push({
        _id: rec._id,
        issueTitle: rec.issueTitle,
        serviceType: rec.serviceType,
        status: rec.status,
        actualCost: rec.actualCost,
        reportedDate: rec.reportedDate,
        completedDate: rec.completedDate,
      });
    });

    // Detect patterns and recommendations
    const patterns = [];
    const productAnalyses = [];
    const globalDefectCounts = {};

    productMap.forEach((entry) => {
      const purchasePrice = entry.purchasePrice || 0;
      const spendRatio = purchasePrice > 0 ? (entry.totalActualCost / purchasePrice) * 100 : 0;
      const avgTurnaround = entry.turnaroundDays.length > 0
        ? Math.round(entry.turnaroundDays.reduce((a, b) => a + b, 0) / entry.turnaroundDays.length)
        : null;

      // Top recurring defects for this product
      const recurringKeywords = Object.entries(entry.defectKeywordCounts)
        .filter(([_, count]) => count >= 2)
        .map(([kw, count]) => ({ keyword: kw, count }));

      Object.entries(entry.defectKeywordCounts).forEach(([kw, count]) => {
        globalDefectCounts[kw] = (globalDefectCounts[kw] || 0) + count;
      });

      const alerts = [];
      const recommendations = [];

      // 1. Spend threshold (> 50% of asset purchase price)
      if (purchasePrice > 0 && spendRatio >= 50) {
        const severity = spendRatio >= 80 ? 'HIGH' : 'MEDIUM';
        const msg = `Cumulative repair expenses have reached ${spendRatio.toFixed(1)}% of asset purchase price (${formatINR(entry.totalActualCost)} spent vs ${formatINR(purchasePrice)} original price).`;
        alerts.push({
          type: 'HIGH_REPAIR_BURDEN',
          severity,
          message: msg,
        });
        patterns.push({
          type: 'HIGH_REPAIR_BURDEN',
          severity,
          productId: entry.productId,
          productName: entry.productName,
          message: msg,
          recommendation: 'Evaluate replacement viability vs ongoing repair investments.',
        });
        recommendations.push('Asset maintenance spend is significant relative to original cost. Further component repairs may not offer good value retention.');
      }

      // 2. Repeated repairs (>= 2 repairs)
      if (entry.repairsCount >= 2) {
        const severity = entry.repairsCount >= 3 ? 'HIGH' : 'MEDIUM';
        const msg = `Device has undergone ${entry.repairsCount} repair events. Frequent failures may indicate systemic hardware wear.`;
        alerts.push({
          type: 'FREQUENT_REPAIRS',
          severity,
          message: msg,
        });
        patterns.push({
          type: 'FREQUENT_REPAIRS',
          severity,
          productId: entry.productId,
          productName: entry.productName,
          message: msg,
          recommendation: 'Request a comprehensive diagnostics report from an authorized service provider to check for underlying systemic defects.',
        });
        recommendations.push('Request an authorized diagnostic inspection to address recurring root causes rather than isolated symptom repairs.');
      }

      // 3. Recurring defect keywords
      recurringKeywords.forEach(({ keyword, count }) => {
        const msg = `Recurring issue detected with "${keyword}" (logged in ${count} service events).`;
        alerts.push({
          type: 'RECURRING_DEFECT',
          severity: count >= 3 ? 'HIGH' : 'MEDIUM',
          message: msg,
        });
        patterns.push({
          type: 'RECURRING_DEFECT',
          severity: count >= 3 ? 'HIGH' : 'MEDIUM',
          productId: entry.productId,
          productName: entry.productName,
          message: msg,
          recommendation: `Verify if the replaced ${keyword} component remains under post-repair parts warranty.`,
        });
        recommendations.push(`Check warranty on replaced ${keyword} parts — authorized repairs typically include 90-day parts coverage.`);
      });

      productAnalyses.push({
        productId: entry.productId,
        productName: entry.productName,
        brand: entry.brand,
        model: entry.model,
        category: entry.category,
        purchasePrice,
        totalActualCost: entry.totalActualCost,
        spendRatio: Number(spendRatio.toFixed(1)),
        totalRecords: entry.totalRecords,
        repairsCount: entry.repairsCount,
        maintenanceCount: entry.maintenanceCount,
        completedCount: entry.completedCount,
        averageTurnaroundDays: avgTurnaround,
        recurringDefects: recurringKeywords,
        alerts,
        recommendations,
      });
    });

    const overallAvgTurnaround = completedTurnaroundDays.length > 0
      ? Math.round(completedTurnaroundDays.reduce((a, b) => a + b, 0) / completedTurnaroundDays.length)
      : null;

    const topDefects = Object.entries(globalDefectCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([keyword, count]) => ({ keyword, count }));

    return {
      totalRecords: records.length,
      totalServiceCost,
      totalRepairs,
      totalMaintenance,
      averageTurnaroundDays: overallAvgTurnaround,
      patterns,
      topRecurringDefects: topDefects,
      products: productAnalyses,
      hasProblematicAssets: patterns.length > 0,
    };
  }

  // --- Internal Helpers ---

  /**
   * Syncs linked Expense record ensuring zero duplicate counting
   */
  async _syncLinkedExpense(serviceRecord, product) {
    const expenseType = serviceRecord.serviceType === 'MAINTENANCE' ? 'MAINTENANCE' : 'REPAIR';

    if (serviceRecord.relatedExpenseId) {
      // Update existing linked expense
      await Expense.findByIdAndUpdate(serviceRecord.relatedExpenseId, {
        amount: serviceRecord.actualCost,
        expenseDate: serviceRecord.completedDate || serviceRecord.reportedDate || new Date(),
        title: serviceRecord.issueTitle,
        description: serviceRecord.issueDescription,
        vendorName: serviceRecord.serviceProvider || serviceRecord.serviceCenterName || 'Authorized Service',
        relatedDocumentId: serviceRecord.relatedDocumentIds?.[0] || null,
      });
    } else {
      // Check if an expense already exists referencing this service record to prevent race conditions
      let expense = await Expense.findOne({
        userId: serviceRecord.userId,
        relatedServiceRecordId: serviceRecord._id,
      });

      if (!expense) {
        expense = await Expense.create({
          userId: serviceRecord.userId,
          productId: serviceRecord.productId,
          expenseType,
          amount: serviceRecord.actualCost,
          currency: 'INR',
          expenseDate: serviceRecord.completedDate || serviceRecord.reportedDate || new Date(),
          title: serviceRecord.issueTitle,
          description: serviceRecord.issueDescription || `${serviceRecord.serviceType} service completed.`,
          vendorName: serviceRecord.serviceProvider || serviceRecord.serviceCenterName || 'Authorized Service',
          relatedDocumentId: serviceRecord.relatedDocumentIds?.[0] || null,
          relatedServiceRecordId: serviceRecord._id,
          source: 'SERVICE',
        });
      }

      serviceRecord.relatedExpenseId = expense._id;
      await serviceRecord.save();
    }
  }

  /**
   * Records service lifecycle event to ownership timeline
   */
  async _recordServiceTimelineEvent(serviceRecord, product, status) {
    if (!product) return;

    let eventType = 'SERVICE';
    let title = 'Service Update';
    let desc = '';
    const costStr = serviceRecord.actualCost > 0 ? ` (Cost: ${formatINR(serviceRecord.actualCost)})` : '';
    const providerStr = serviceRecord.serviceProvider ? ` at ${serviceRecord.serviceProvider}` : '';

    switch (status) {
      case 'REQUESTED':
        eventType = 'SERVICE_REQUESTED';
        title = `Service Requested: ${serviceRecord.issueTitle}`;
        desc = `Reported: ${serviceRecord.issueDescription || 'Service requested by owner.'}${providerStr}`;
        break;
      case 'SCHEDULED':
        eventType = 'SERVICE_SCHEDULED';
        title = `Service Scheduled: ${serviceRecord.issueTitle}`;
        desc = `Scheduled for ${formatDateIN(serviceRecord.scheduledDate || new Date())}${providerStr}.`;
        break;
      case 'IN_SERVICE':
        eventType = 'SERVICE_IN_PROGRESS';
        title = `Device In Service: ${serviceRecord.issueTitle}`;
        desc = `Work started${providerStr}.`;
        break;
      case 'COMPLETED':
        eventType = 'SERVICE_COMPLETED';
        title = `Service Completed: ${serviceRecord.issueTitle}`;
        desc = `Service finished${providerStr}.${costStr}`;
        break;
      case 'CANCELLED':
        eventType = 'SERVICE_CANCELLED';
        title = `Service Cancelled: ${serviceRecord.issueTitle}`;
        desc = `Service request was cancelled.`;
        break;
      default:
        eventType = 'SERVICE';
        title = `Service: ${serviceRecord.issueTitle}`;
        desc = `${serviceRecord.issueDescription || 'Service record updated.'}`;
        break;
    }

    await timelineService.recordEvent({
      userId: serviceRecord.userId,
      productId: serviceRecord.productId,
      eventType,
      title,
      description: desc,
      eventDate: serviceRecord.completedDate || serviceRecord.scheduledDate || serviceRecord.reportedDate || new Date(),
      source: 'SERVICE',
      relatedDocumentId: serviceRecord.relatedDocumentIds?.[0] || null,
      metadata: {
        serviceRecordId: String(serviceRecord._id),
        serviceType: serviceRecord.serviceType,
        actualCost: serviceRecord.actualCost,
      },
    });
  }

  /**
   * Creates an intelligent alert for a scheduled appointment
   */
  async _createScheduledAlert(serviceRecord, product) {
    const existing = await Alert.findOne({
      userId: serviceRecord.userId,
      serviceRecordId: serviceRecord._id,
      type: 'SERVICE',
    });

    if (!existing && serviceRecord.scheduledDate) {
      await Alert.create({
        userId: serviceRecord.userId,
        productId: serviceRecord.productId,
        type: 'SERVICE',
        serviceRecordId: serviceRecord._id,
        title: `Service Appointment: ${product.productName}`,
        message: `Scheduled service for "${serviceRecord.issueTitle}" on ${formatDateIN(serviceRecord.scheduledDate)}.`,
        priority: 'MEDIUM',
      });
    }
  }

  /**
   * Compute counts for UI tabs
   */
  async _getServiceCounts(userId, productId = null) {
    const baseFilter = { userId };
    if (productId) baseFilter.productId = productId;

    const [all, active, completed, warrantyClaims] = await Promise.all([
      ServiceRecord.countDocuments(baseFilter),
      ServiceRecord.countDocuments({
        ...baseFilter,
        status: { $in: ['REQUESTED', 'SCHEDULED', 'IN_SERVICE', 'WAITING_FOR_PARTS'] },
      }),
      ServiceRecord.countDocuments({ ...baseFilter, status: 'COMPLETED' }),
      ServiceRecord.countDocuments({
        ...baseFilter,
        $or: [{ serviceType: 'WARRANTY_CLAIM' }, { warrantyRelated: true }],
      }),
    ]);

    return { all, active, completed, warrantyClaims };
  }
}

export default new ServiceRecordService();
