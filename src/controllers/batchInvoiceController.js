import mongoose from "mongoose";
import BatchInvoice from "../models/BatchInvoice.js";

import { previewNumberCal } from "./numberCalController.js";

/* =====================================================
   LIMITS
===================================================== */

const MAX_MAIN_GROUPS = 30;
const MAX_SUB_GROUPS = 100;
const MAX_ROWS_PER_GROUP = 500;
const MAX_TOTAL_ROWS = 5000;

/* =====================================================
   ERRORS
===================================================== */

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const validId = (value) => mongoose.isValidObjectId(value);

const requiredId = (value, field) => {
  if (!validId(value)) {
    throw badRequest(`Invalid ${field}.`);
  }

  return String(value);
};

const normalizeIds = (values) => [...new Set(values.map(String))].sort();

const safeName = (value, fallback) =>
  String(value || fallback)
    .trim()
    .slice(0, 100);

/* =====================================================
   VALIDATE ROWS
===================================================== */

const validateRows = (rows, groupLabel) => {
  if (
    !Array.isArray(rows) ||
    rows.length < 1 ||
    rows.length > MAX_ROWS_PER_GROUP
  ) {
    throw badRequest(
      `${groupLabel} must contain 1-${MAX_ROWS_PER_GROUP} entries.`,
    );
  }

  return rows.map((item, index) => {
    const raw = String(item?.raw ?? "").trim();
    const baseValue = Number(item?.baseValue);

    if (
      !raw ||
      raw.length > 80 ||
      !Number.isFinite(baseValue) ||
      baseValue <= 0 ||
      baseValue > 1e9
    ) {
      throw badRequest(`Invalid entry ${index + 1} in ${groupLabel}.`);
    }

    return { raw, baseValue };
  });
};

/* =====================================================
   VALIDATE GROUPED INVOICE
===================================================== */

const validateInvoice = (groups) => {
  if (
    !Array.isArray(groups) ||
    groups.length < 1 ||
    groups.length > MAX_MAIN_GROUPS
  ) {
    throw badRequest(
      `Invoice must contain 1-${MAX_MAIN_GROUPS} main categories.`,
    );
  }

  const usedMainCategories = new Set();

  let totalGroups = 0;
  let totalRows = 0;

  const normalized = groups.map((main, mainIndex) => {
    const category = requiredId(
      main?.category,
      `main category ${mainIndex + 1}`,
    );

    if (usedMainCategories.has(category)) {
      throw badRequest("Duplicate main category in invoice.");
    }

    usedMainCategories.add(category);

    const categoryName = safeName(main.categoryName, "Category");

    /*
      New nested group request.
    */
    if (Array.isArray(main.subGroups)) {
      if (!main.subGroups.length) {
        throw badRequest(`${categoryName} requires at least one group.`);
      }

      const usedSets = new Set();

      const subGroups = main.subGroups.map((group, groupIndex) => {
        /*
            Support both:
              subCategories: [id1, id2]
            and older:
              subCategory: id1
          */
        const suppliedIds = Array.isArray(group?.subCategories)
          ? group.subCategories
          : group?.subCategory
            ? [group.subCategory]
            : [];

        if (!suppliedIds.length) {
          throw badRequest(`Group ${groupIndex + 1} has no subcategories.`);
        }

        const subCategories = normalizeIds(
          suppliedIds.map((id) => requiredId(id, "subcategory")),
        );

        /*
            Same set may not be duplicated under
            the same main category.
          */
        const setKey = subCategories.join("|");

        if (usedSets.has(setKey)) {
          throw badRequest(`Duplicate subcategory group in ${categoryName}.`);
        }

        usedSets.add(setKey);

        const requestedNames = Array.isArray(group.subCategoryNames)
          ? group.subCategoryNames
          : group.subCategoryName
            ? [group.subCategoryName]
            : [];

        const subCategoryNames = requestedNames
          .map((name) => safeName(name, ""))
          .filter(Boolean)
          .slice(0, 40);

        const groupLabel =
          `${categoryName} / ` + (subCategoryNames.join(", ") || setKey);

        const calculatorData = validateRows(group.calculatorData, groupLabel);

        totalGroups++;
        totalRows += calculatorData.length;

        return {
          subCategories,
          subCategoryNames,
          calculatorData,
        };
      });

      return {
        type: "nested",
        category,
        categoryName,
        subGroups,
      };
    }

    /*
      Backward compatibility for flat requests.
    */
    const oldIds = Array.isArray(main.subCategories) ? main.subCategories : [];

    const subCategories = normalizeIds(
      oldIds.map((id) => requiredId(id, "subcategory")),
    );

    const calculatorData = validateRows(main.calculatorData, categoryName);

    totalGroups++;
    totalRows += calculatorData.length;

    return {
      type: "flat",
      category,
      categoryName,
      subCategories,

      subCategoryNames: Array.isArray(main.subCategoryNames)
        ? main.subCategoryNames.map((name) => safeName(name, "")).slice(0, 40)
        : [],

      calculatorData,
    };
  });

  if (totalGroups > MAX_SUB_GROUPS) {
    throw badRequest("Too many subcategory groups.");
  }

  if (totalRows > MAX_TOTAL_ROWS) {
    throw badRequest("Too many invoice entries.");
  }

  return normalized;
};

/* =====================================================
   CALL EXISTING PREVIEW CONTROLLER

   Your existing previewNumberCal must return
   one result row per submitted calculator row.
===================================================== */

const previewOnServer = async (req, payload) => {
  let statusCode = 200;
  let responseBody;
  let responded = false;

  const previewRes = {
    status(code) {
      statusCode = code;
      return this;
    },

    json(value) {
      responseBody = value;
      responded = true;
      return this;
    },

    send(value) {
      responseBody = value;
      responded = true;
      return this;
    },
  };

  /*
    Reuse the existing calculation endpoint internally.
    This must be a preview-only function, not a save.
  */
  await previewNumberCal(
    {
      ...req,
      body: payload,
    },
    previewRes,
    (error) => {
      if (error) throw error;
    },
  );

  if (!responded) {
    throw new Error("Calculation preview did not return a response.");
  }

  if (statusCode >= 400) {
    throw badRequest(
      responseBody?.message ||
        responseBody?.error ||
        "Calculation preview failed.",
    );
  }

  const result = responseBody?.data?.data ?? responseBody?.data ?? responseBody;

  let rows;

  if (Array.isArray(result)) {
    rows = result;
  } else {
    rows =
      result?.calculatorData ??
      result?.lines ??
      result?.items ??
      result?.calculations;
  }

  if (!Array.isArray(rows)) {
    throw badRequest("Preview did not return calculation rows.");
  }

  return rows;
};

/* =====================================================
   RECALCULATE GROUP
===================================================== */

const calculateRows = async (req, category, subCategories, inputRows) => {
  const previewed = await previewOnServer(req, {
    category,
    subCategories,
    calculatorData: inputRows,
  });

  if (previewed.length !== inputRows.length) {
    throw badRequest("Calculation preview returned a different row count.");
  }

  return previewed.map((item, index) => {
    const score = Number(
      item.score ?? item.calculatedScore ?? item.totalScore ?? item.result,
    );

    if (!Number.isFinite(score)) {
      throw badRequest(`Invalid calculation score for entry ${index + 1}.`);
    }

    const row = {
      raw: inputRows[index].raw,
      baseValue: inputRows[index].baseValue,
      score,
    };

    for (const field of [
      "number",
      "prefix",
      "endNumber",
      "digitLength",
      "signWeight",
      "subCategoryTotal",
    ]) {
      const value = item[field];

      if (value !== undefined && value !== null) {
        row[field] = value;
      }
    }

    return row;
  });
};

/* =====================================================
   CREATE ONE INVOICE
===================================================== */

export const createBatchInvoice = async (req, res) => {
  try {
    const userId = req.user?._id ?? req.user?.id;

    if (!userId || !validId(userId)) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    const validated = validateInvoice(req.body?.groups);

    const groups = [];

    /*
      Calculate every group before saving anything.
    */
    for (const main of validated) {
      if (main.type === "nested") {
        const subGroups = [];

        for (const sub of main.subGroups) {
          const rows = await calculateRows(
            req,
            main.category,
            sub.subCategories,
            sub.calculatorData,
          );

          const groupScore = rows.reduce((total, row) => total + row.score, 0);

          const totalBaseValue = rows.reduce(
            (total, row) => total + row.baseValue,
            0,
          );

          subGroups.push({
            subCategories: sub.subCategories,
            subCategoryNames: sub.subCategoryNames,

            calculatorData: rows,

            groupScore,
            totalBaseValue,
          });
        }

        groups.push({
          category: main.category,
          categoryName: main.categoryName,

          subGroups,

          groupScore: subGroups.reduce(
            (total, group) => total + group.groupScore,
            0,
          ),

          totalBaseValue: subGroups.reduce(
            (total, group) => total + group.totalBaseValue,
            0,
          ),
        });
      } else {
        /*
          Support older flat requests.
        */
        const rows = await calculateRows(
          req,
          main.category,
          main.subCategories,
          main.calculatorData,
        );

        groups.push({
          category: main.category,
          categoryName: main.categoryName,

          subCategories: main.subCategories,
          subCategoryNames: main.subCategoryNames,
          calculatorData: rows,

          groupScore: rows.reduce((total, row) => total + row.score, 0),

          totalBaseValue: rows.reduce((total, row) => total + row.baseValue, 0),
        });
      }
    }

    const grandScore = groups.reduce(
      (total, group) => total + group.groupScore,
      0,
    );

    const totalBaseValue = groups.reduce(
      (total, group) => total + group.totalBaseValue,
      0,
    );

    /*
      ONE insert = ONE invoice document.
    */
    const invoice = await BatchInvoice.create({
      groups,
      grandScore,
      totalBaseValue,
      createdBy: userId,
    });

    return res.status(201).json({
      message: "Invoice saved successfully.",
      data: invoice,
    });
  } catch (error) {
    console.error("CREATE BATCH INVOICE ERROR:", error);

    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Unable to save invoice.",
    });
  }
};

/* =====================================================
   LIST INVOICES
===================================================== */

export const listBatchInvoices = async (req, res) => {
  try {
    const filter =
      req.user?.role === "SUPER_ADMIN" ? {} : { createdBy: req.user._id };

    const records = await BatchInvoice.find(filter)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    return res.json({
      data: records,
    });
  } catch (error) {
    console.error("LIST BATCH INVOICES ERROR:", error);

    return res.status(500).json({
      message: "Unable to load invoices.",
    });
  }
};

/* =====================================================
   GET ONE INVOICE
===================================================== */

export const getBatchInvoice = async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid invoice ID.",
      });
    }

    const filter = {
      _id: req.params.id,
    };

    if (req.user?.role !== "SUPER_ADMIN") {
      filter.createdBy = req.user._id;
    }

    const record = await BatchInvoice.findOne(filter).lean();

    if (!record) {
      return res.status(404).json({
        message: "Invoice not found.",
      });
    }

    return res.json({
      data: record,
    });
  } catch (error) {
    console.error("GET BATCH INVOICE ERROR:", error);

    return res.status(500).json({
      message: "Unable to load invoice.",
    });
  }
};

/* =====================================================
   DELETE ONE INVOICE
===================================================== */

export const deleteBatchInvoice = async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid invoice ID.",
      });
    }

    const filter = {
      _id: req.params.id,
    };

    if (req.user?.role !== "SUPER_ADMIN") {
      filter.createdBy = req.user._id;
    }

    const record = await BatchInvoice.findOneAndDelete(filter);

    if (!record) {
      return res.status(404).json({
        message: "Invoice not found.",
      });
    }

    return res.json({
      message: "Invoice deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE BATCH INVOICE ERROR:", error);

    return res.status(500).json({
      message: "Unable to delete invoice.",
    });
  }
};
