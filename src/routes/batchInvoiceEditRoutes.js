import { Router } from 'express';
import mongoose from 'mongoose';
import BatchInvoiceRevision from '../models/BatchInvoiceRevision.js';

/**
 * Full submitted-invoice edit router (ES module .js).
 *
 * Mount BEFORE existing /batch-invoices routes:
 *   app.use('/api/batch-invoices', createBatchInvoiceEditRoutes({
 *     BatchInvoice,
 *     requireAuth,
 *     canEditInvoice,
 *     previewRows,           // ORIGINAL server calculator, shared with /number-cal/preview
 *     assertSafeToEdit,     // Guard linked balances/financial side effects
 *   }));
 *
 * This module does NOT replace existing creation/list routes.
 */
export function createBatchInvoiceEditRoutes({
  BatchInvoice,
  requireAuth,
  canEditInvoice,
  previewRows,
  assertSafeToEdit,
}) {
  if (!BatchInvoice ||
      typeof requireAuth !== 'function' ||
      typeof canEditInvoice !== 'function' ||
      typeof previewRows !== 'function' ||
      typeof assertSafeToEdit !== 'function') {
    throw new Error(
      'Provide BatchInvoice, requireAuth, canEditInvoice, previewRows and assertSafeToEdit',
    );
  }
  const router = Router();
  router.use(requireAuth);

  const fail = (status, message) => Object.assign(new Error(message), { status });
  const handler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res)).catch((error) => {
      if (res.headersSent) return next(error);
      res.status(error.status || 500).json({ message: error.status ? error.message : 'Invoice update failed' });
    });

  const validId = (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid invoice ID' });
    }
    next();
  };
  const actorId = (req) => String(req.user?._id ?? req.user?.id ?? '');
  const requireReason = (reason) => {
    if (typeof reason !== 'string' || reason.trim().length < 3 || reason.trim().length > 500) {
      throw fail(400, 'Correction reason must be 3–500 characters');
    }
    return reason.trim();
  };
  async function permittedInvoice(req) {
    const invoice = await BatchInvoice.findById(req.params.id).lean();
    if (!invoice) throw fail(404, 'Invoice not found');
    if (!actorId(req) || !(await canEditInvoice(invoice, req))) throw fail(403, 'Forbidden');
    return invoice;
  }
  async function buildValidatedGroups(input, req) {
    if (!Array.isArray(input) || !input.length || input.length > 50) {
      throw fail(400, 'Invoice must contain 1–50 categories');
    }
    const result = [];
    const seenGroups = new Set();
    let grandScore = 0;
    let rowCount = 0;
    for (const main of input) {
      if (!mongoose.isValidObjectId(main?.category) ||
          !Array.isArray(main?.subGroups) ||
          main.subGroups.length < 1 || main.subGroups.length > 50) {
        throw fail(400, 'Invalid category or subgroup structure');
      }
      const category = String(main.category);
      const entry = {
        category,
        categoryName: String(main.categoryName || '').slice(0, 150),
        subGroups: [],
      };
      for (const sub of main.subGroups) {
        const ids = [...new Set((sub?.subCategories || []).map(String))].sort();
        if (!ids.length || ids.length > 50 || !ids.every(mongoose.isValidObjectId)) {
          throw fail(400, 'Invalid subcategory IDs');
        }
        const groupKey = `${category}::${ids.join('|')}`;
        if (seenGroups.has(groupKey)) throw fail(400, 'Duplicate subgroup');
        seenGroups.add(groupKey);
        if (!Array.isArray(sub.calculatorData) ||
            !sub.calculatorData.length || sub.calculatorData.length > 500) {
          throw fail(400, 'Each subgroup must have 1–500 calculation rows');
        }
        rowCount += sub.calculatorData.length;
        if (rowCount > 2000) throw fail(400, 'Invoice has too many rows');
        const rows = sub.calculatorData.map((row) => {
          const raw = String(row?.raw ?? '').trim();
          const value = Number(row?.baseValue);
          const match = raw.match(/^(\d{2,3})(?:>(\d{2,3})|[x:])$/);
          if (!match) throw fail(400, `Invalid number expression: ${raw}`);
          if (match[2] &&
              (match[1].length !== match[2].length || Number(match[1]) > Number(match[2]))) {
            throw fail(400, `Invalid range: ${raw}`);
          }
          if (!Number.isFinite(value) || value <= 0 || value > 1e10) {
            throw fail(400, 'Invalid amount');
          }
          return { raw, baseValue: value };
        });

        // Uses your original, authoritative backend rules for ALL operators.
        // NEVER trust submitted score or multiplier from the browser.
        const calculated = await previewRows({
          category,
          subCategories: ids,
          calculatorData: rows,
          user: req.user,
        });
        if (!Array.isArray(calculated) || calculated.length !== rows.length) {
          throw fail(500, 'Backend calculator response was invalid');
        }
        const calculatorData = calculated.map((line, i) => {
          const score = Number(line.score ?? line.calculatedScore ?? line.totalScore ?? line.result);
          if (!Number.isFinite(score)) throw fail(500, 'Backend calculator returned an invalid score');
          return { ...rows[i], score };
        });
        const groupScore = calculatorData.reduce((sum, line) => sum + line.score, 0);
        grandScore += groupScore;
        entry.subGroups.push({
          subCategories: ids,
          subCategoryNames: Array.isArray(sub.subCategoryNames)
            ? sub.subCategoryNames.map(String).slice(0, 50) : [],
          calculatorData,
          groupScore,
        });
      }
      result.push(entry);
    }
    if (!Number.isFinite(grandScore)) throw fail(400, 'Invoice total overflow');
    return { groups: result, grandScore };
  }

  /** Atomic invoice update and a durable audit record; requires no model migration. */
  async function changeInvoice(req, res, { action, inputGroups, targetVersion = null }) {
    const reason = requireReason(req.body?.reason);
    const invoice = await permittedInvoice(req);
    if (['VOID', 'CANCELLED', 'DELETED'].includes(invoice.status)) {
      throw fail(409, 'This invoice cannot be modified');
    }
    await assertSafeToEdit(invoice, req); // deny edits on linked balance effects unless adjusted transactionally
    const version = Number(invoice.__v ?? 0);
    const requestedVersion = req.body?.expectedVersion;
    if (!Number.isSafeInteger(requestedVersion) || requestedVersion !== version) {
      throw fail(409, 'Invoice was changed. Reload before editing.');
    }
    const { groups, grandScore } = await buildValidatedGroups(inputGroups, req);
    const before = {
      groups: invoice.groups,
      grandScore: invoice.grandScore,
      status: invoice.status,
    };
    const after = { groups, grandScore, status: invoice.status };
    const audit = await BatchInvoiceRevision.create({
      invoiceId: invoice._id,
      action,
      reason,
      fromVersion: version,
      toVersion: version + 1,
      targetVersion,
      actorId: actorId(req),
      before,
      after,
      state: 'PENDING',
    });
    let updated;
    try {
      const versionMatch = invoice.__v === undefined
        ? { $or: [{ __v: { $exists: false } }, { __v: 0 }] }
        : { __v: version };
      updated = await BatchInvoice.findOneAndUpdate(
        { _id: invoice._id, ...versionMatch },
        { $set: { groups, grandScore }, $inc: { __v: 1 } },
        { new: true, runValidators: true },
      ).lean();
      if (!updated) {
        await BatchInvoiceRevision.updateOne(
          { _id: audit._id },
          { $set: { state: 'ABORTED', error: 'Concurrent modification' } },
        );
        throw fail(409, 'Invoice was changed by another user. Reload.');
      }
    } catch (err) {
      if (!updated && err.status !== 409) {
        await BatchInvoiceRevision.updateOne(
          { _id: audit._id },
          { $set: { state: 'ABORTED', error: String(err.message).slice(0, 200) } },
        );
      }
      throw err;
    }
    // If this write fails, the PENDING audit record is retained for recovery.
    await BatchInvoiceRevision.updateOne(
      { _id: audit._id },
      { $set: { state: 'APPLIED', committedAt: new Date() } },
    );
    res.json({ data: { invoice: { ...updated, version: Number(updated.__v ?? version + 1) } } });
  }

  router.get('/:id/revisions', validId, handler(async (req, res) => {
    await permittedInvoice(req);
    const revisions = await BatchInvoiceRevision.find({
      invoiceId: req.params.id,
      state: 'APPLIED',
    }).sort({ createdAt: -1 }).select('-before -after').lean();
    res.json({ data: revisions });
  }));

  router.get('/:id', validId, handler(async (req, res) => {
    const invoice = await permittedInvoice(req);
    res.json({ data: { invoice: { ...invoice, version: Number(invoice.__v ?? 0) } } });
  }));

  router.put('/:id', validId, handler(async (req, res) => {
    return changeInvoice(req, res, { action: 'EDIT', inputGroups: req.body?.groups });
  }));

  router.post('/:id/rollback', validId, handler(async (req, res) => {
    await permittedInvoice(req);
    const targetVersion = req.body?.targetVersion;
    if (!Number.isSafeInteger(targetVersion) || targetVersion < 0) {
      throw fail(400, 'targetVersion must be a non-negative integer');
    }
    const revision = await BatchInvoiceRevision.findOne({
      invoiceId: req.params.id,
      fromVersion: targetVersion,
      state: 'APPLIED',
    }).lean();
    if (!revision) throw fail(404, 'Historical revision not found');
    // Restore original row inputs, then recalculate with CURRENT rules.
    return changeInvoice(req, res, {
      action: 'ROLLBACK',
      inputGroups: revision.before.groups,
      targetVersion,
    });
  }));
  return router;
}
