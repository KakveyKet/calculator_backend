import mongoose from "mongoose";

import NumberCal from "../models/NumberCal.js";
import Category from "../models/Category.js";
import SubCategory from "../models/SubCategory.js";

/* =========================================================
   NUMBER
========================================================= */

const safeNumber = (value, fallback = 0) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
};

/* =========================================================
   USER ID
========================================================= */

const getUserId = (req) => {
  return (
    req.currentUser?._id ||
    req.user?._id ||
    req.user?.id ||
    req.user?.userId ||
    req.user?.sub ||
    null
  );
};

/* =========================================================
   GET ID
========================================================= */

const getId = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "object") {
    return value._id || value.id || value.value || null;
  }

  return String(value);
};

/* =========================================================
   VALID OBJECT ID
========================================================= */

const isValidId = (value) => {
  const id = getId(value);

  return Boolean(id && mongoose.Types.ObjectId.isValid(id));
};

/* =========================================================
   PARSE EXPRESSION

   Examples:

   10>15
   112x
   11x
   13:
========================================================= */

const parseExpression = (row) => {
  const raw = String(row?.raw ?? row?.expression ?? "").trim();

  /* =====================================================
     RANGE
  ===================================================== */

  if (raw.includes(">")) {
    const [start, end] = raw.split(">");

    return {
      raw,

      number: String(start || "").trim(),

      prefix: ">",

      endNumber: String(end || "").trim(),
    };
  }

  /* =====================================================
     MULTI
  ===================================================== */

  if (raw.toLowerCase().endsWith("x")) {
    return {
      raw,

      number: raw.slice(0, -1).trim(),

      prefix: "x",

      endNumber: "",
    };
  }

  /* =====================================================
     SINGLE
  ===================================================== */

  if (raw.endsWith(":")) {
    return {
      raw,

      number: raw.slice(0, -1).trim(),

      prefix: ":",

      endNumber: "",
    };
  }

  /* =====================================================
     FALLBACK SAVED FIELDS
  ===================================================== */

  const number = String(row?.number ?? raw).trim();

  const prefix = [">", "x", ":"].includes(row?.prefix) ? row.prefix : ":";

  return {
    raw: raw || `${number}${prefix}`,

    number,

    prefix,

    endNumber: String(row?.endNumber ?? "").trim(),
  };
};

/* =========================================================
   SIGN WEIGHT
========================================================= */

const calculateSignWeight = ({ number, prefix, endNumber }) => {
  /* =====================================================
     RANGE

     10 > 15
     10,11,12,13,14,15

     = 6
  ===================================================== */

  if (prefix === ">") {
    const start = Number(number);

    const end = Number(endNumber);

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return 0;
    }

    if (end < start) {
      return 0;
    }

    return end - start + 1;
  }

  /* =====================================================
     MULTI
  ===================================================== */

  if (prefix === "x") {
    /*
     * 2 digits
     *
     * 11x
     * multiplier = 1
     */
    if (number.length === 2) {
      return 1;
    }

    /*
     * 3 digits
     *
     * first two digits equal:
     *
     * 112
     * 226
     * 339
     *
     * multiplier = 3
     *
     * otherwise = 6
     */
    if (number.length === 3) {
      if (number[0] === number[1]) {
        return 3;
      }

      return 6;
    }

    return 1;
  }

  /* =====================================================
     SINGLE
  ===================================================== */

  return 1;
};

/* =========================================================
   NORMALIZE SUB CATEGORY IDS
========================================================= */

const normalizeSubCategoryIds = (values) => {
  if (!Array.isArray(values)) {
    return [];
  }

  return [
    ...new Set(
      values.map(getId).filter((id) => mongoose.Types.ObjectId.isValid(id)),
    ),
  ];
};

/* =========================================================
   LOAD SUB CATEGORIES
========================================================= */

const loadSubCategories = async (values) => {
  const ids = normalizeSubCategoryIds(values);

  if (!ids.length) {
    return [];
  }

  return SubCategory.find({
    _id: {
      $in: ids,
    },
  }).select("_id name number2Digit number3Digit category");
};

/* =========================================================
   SUB CATEGORY TOTAL

   2 digits:
   sum number2Digit

   3 digits:
   sum number3Digit
========================================================= */

const calculateSubCategoryTotal = (number, subCategories, fallback = 0) => {
  const digitLength = String(number || "").length;

  if (!Array.isArray(subCategories) || !subCategories.length) {
    return safeNumber(fallback);
  }

  if (digitLength === 2) {
    return subCategories.reduce(
      (total, item) => total + safeNumber(item.number2Digit),
      0,
    );
  }

  if (digitLength === 3) {
    return subCategories.reduce(
      (total, item) => total + safeNumber(item.number3Digit),
      0,
    );
  }

  return safeNumber(fallback);
};

/* =========================================================
   CALCULATE ROWS
========================================================= */

const calculateRows = async ({
  calculatorData = [],
  subCategories = [],
  categoryId = null,
}) => {
  const subCategoryDocs = await loadSubCategories(subCategories);

  const inputRows = Array.isArray(calculatorData) ? calculatorData : [];

  const rows = inputRows.map((originalRow) => {
    const parsed = parseExpression(originalRow);

    const baseValue = safeNumber(
      originalRow?.baseValue ??
        originalRow?.amount ??
        originalRow?.value ??
        originalRow?.inputAmount ??
        originalRow?.inputValue,
    );

    const signWeight = calculateSignWeight(parsed);

    const subCategoryTotal = calculateSubCategoryTotal(
      parsed.number,
      subCategoryDocs,
      originalRow?.subCategoryTotal,
    );

    const score = subCategoryTotal * baseValue * signWeight;

    return {
      raw: parsed.raw,

      number: parsed.number,

      prefix: parsed.prefix,

      endNumber: parsed.endNumber,

      digitLength: parsed.number.length,

      categoryId:
        categoryId && mongoose.Types.ObjectId.isValid(categoryId)
          ? categoryId
          : null,

      baseValue,

      subCategoryTotal,

      signWeight,

      score,
    };
  });

  const grandScore = rows.reduce(
    (total, row) => total + safeNumber(row.score),
    0,
  );

  const totalBaseValue = rows.reduce(
    (total, row) => total + safeNumber(row.baseValue),
    0,
  );

  return {
    calculatorData: rows,
    grandScore,
    totalBaseValue,
  };
};

/* =========================================================
   RESOLVE CATEGORY

   1. body.category
   2. body.categoryId
   3. body.selectedCategory
   4. body.categories[0]
   5. calculator row categoryId
   6. selected subcategory's category
========================================================= */

const resolveCategory = async (body) => {
  let candidate =
    getId(body?.category) ||
    getId(body?.categoryId) ||
    getId(body?.selectedCategory);

  /* =====================================================
     OLD CATEGORIES ARRAY
  ===================================================== */

  if (!candidate && Array.isArray(body?.categories) && body.categories.length) {
    candidate = getId(body.categories[0]);
  }

  /* =====================================================
     CALCULATOR ROW CATEGORY
  ===================================================== */

  if (!candidate && Array.isArray(body?.calculatorData)) {
    const row = body.calculatorData.find(
      (item) => item?.categoryId || item?.category,
    );

    if (row) {
      candidate = getId(row.categoryId || row.category);
    }
  }

  /* =====================================================
     FIND BY CATEGORY ID
  ===================================================== */

  if (candidate && mongoose.Types.ObjectId.isValid(candidate)) {
    const category =
      await Category.findById(candidate).select("_id name number");

    if (category) {
      return {
        category: category._id,

        categoryName: category.name,
      };
    }
  }

  /* =====================================================
     FIND CATEGORY BY NAME
  ===================================================== */

  if (candidate && !mongoose.Types.ObjectId.isValid(candidate)) {
    const category = await Category.findOne({
      name: {
        $regex: `^${String(candidate).trim()}$`,

        $options: "i",
      },
    }).select("_id name number");

    if (category) {
      return {
        category: category._id,

        categoryName: category.name,
      };
    }
  }

  /* =====================================================
     FALLBACK FROM SUB CATEGORIES
  ===================================================== */

  const subCategoryIds = normalizeSubCategoryIds(body?.subCategories);

  if (subCategoryIds.length) {
    const subCategory = await SubCategory.findOne({
      _id: {
        $in: subCategoryIds,
      },
    })
      .select("_id name category")
      .populate("category", "_id name number");

    if (subCategory?.category) {
      return {
        category: subCategory.category._id,

        categoryName: subCategory.category.name,
      };
    }
  }

  return {
    category: null,
    categoryName: "",
  };
};

/* =========================================================
   POPULATE
========================================================= */

const populateRecord = (query) => {
  return query
    .populate("category", "name number")

    .populate("categories", "name number")

    .populate({
      path: "subCategories",

      select: "name number2Digit number3Digit category",

      populate: {
        path: "category",

        select: "name number",
      },
    })

    .populate("createdBy", "name username email");
};

/* =========================================================
   PREVIEW
========================================================= */

export const previewNumberCal = async (req, res) => {
  try {
    const calculatorData = Array.isArray(req.body.calculatorData)
      ? req.body.calculatorData
      : Array.isArray(req.body.rows)
        ? req.body.rows
        : Array.isArray(req.body.items)
          ? req.body.items
          : [];

    const subCategories =
      req.body.subCategories || req.body.selectedSubCategories || [];

    if (!calculatorData.length) {
      return res.status(400).json({
        success: false,

        message: "Calculator data is required.",
      });
    }

    const categoryData = await resolveCategory({
      ...req.body,

      calculatorData,

      subCategories,
    });

    const result = await calculateRows({
      calculatorData,

      subCategories,

      categoryId: categoryData.category,
    });

    return res.status(200).json({
      success: true,

      data: result,

      calculatorData: result.calculatorData,

      grandScore: result.grandScore,

      totalBaseValue: result.totalBaseValue,

      category: categoryData.category,

      categoryName: categoryData.categoryName,
    });
  } catch (error) {
    console.error("PREVIEW NUMBER CAL ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Unable to preview calculation.",
    });
  }
};

/* =========================================================
   CREATE
========================================================= */

export const createNumberCal = async (req, res) => {
  try {
    const calculatorData = Array.isArray(req.body.calculatorData)
      ? req.body.calculatorData
      : Array.isArray(req.body.rows)
        ? req.body.rows
        : Array.isArray(req.body.items)
          ? req.body.items
          : [];

    const subCategories =
      req.body.subCategories || req.body.selectedSubCategories || [];

    if (!calculatorData.length) {
      return res.status(400).json({
        success: false,

        message: "Calculator data is required.",
      });
    }

    /* ===================================================
         SUB CATEGORY IDS
      =================================================== */

    const subCategoryIds = normalizeSubCategoryIds(subCategories);

    /* ===================================================
         CATEGORY
      =================================================== */

    const categoryData = await resolveCategory({
      ...req.body,

      calculatorData,

      subCategories: subCategoryIds,
    });

    console.log("RESOLVED CATEGORY:", categoryData);

    /* ===================================================
         CALCULATE AGAIN BEFORE SAVE
      =================================================== */

    const result = await calculateRows({
      calculatorData,

      subCategories: subCategoryIds,

      categoryId: categoryData.category,
    });

    /* ===================================================
         CREATE
      =================================================== */

    const created = await NumberCal.create({
      category: categoryData.category,

      categoryName: categoryData.categoryName,

      categories: categoryData.category ? [categoryData.category] : [],

      subCategories: subCategoryIds,

      calculatorData: result.calculatorData,

      grandScore: result.grandScore,

      totalBaseValue: result.totalBaseValue,

      createdBy: getUserId(req),
    });

    /* ===================================================
         POPULATE
      =================================================== */

    const record = await populateRecord(NumberCal.findById(created._id));

    return res.status(201).json({
      success: true,

      message: "Record saved successfully.",

      data: record,
    });
  } catch (error) {
    console.error("CREATE NUMBER CAL ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Unable to save record.",
    });
  }
};

/* =========================================================
   GET ALL
========================================================= */

export const getNumberCals = async (req, res) => {
  try {
    const records = await populateRecord(NumberCal.find()).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,

      data: records,
    });
  } catch (error) {
    console.error("GET NUMBER CALS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Unable to load records.",
    });
  }
};

/* =========================================================
   GET ONE
========================================================= */

export const getNumberCalById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,

        message: "Invalid record ID.",
      });
    }

    const record = await populateRecord(NumberCal.findById(id));

    if (!record) {
      return res.status(404).json({
        success: false,

        message: "Record not found.",
      });
    }

    return res.status(200).json({
      success: true,

      data: record,
    });
  } catch (error) {
    console.error("GET NUMBER CAL ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Unable to load record.",
    });
  }
};

/* =========================================================
   UPDATE
========================================================= */

export const updateNumberCal = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,

        message: "Invalid record ID.",
      });
    }

    const record = await NumberCal.findById(id);

    if (!record) {
      return res.status(404).json({
        success: false,

        message: "Record not found.",
      });
    }

    /* ===================================================
         SUB CATEGORY
      =================================================== */

    const incomingSubCategories =
      req.body.subCategories || req.body.selectedSubCategories;

    let subCategoryIds = record.subCategories.map((item) => getId(item));

    if (Array.isArray(incomingSubCategories)) {
      subCategoryIds = normalizeSubCategoryIds(incomingSubCategories);

      record.subCategories = subCategoryIds;
    }

    /* ===================================================
         CATEGORY
      =================================================== */

    const categoryData = await resolveCategory({
      ...req.body,

      subCategories: subCategoryIds,

      calculatorData: req.body.calculatorData || record.calculatorData,
    });

    if (categoryData.category) {
      record.category = categoryData.category;

      record.categoryName = categoryData.categoryName;

      record.categories = [categoryData.category];
    }

    /* ===================================================
         CALCULATOR
      =================================================== */

    if (Array.isArray(req.body.calculatorData)) {
      const result = await calculateRows({
        calculatorData: req.body.calculatorData,

        subCategories: subCategoryIds,

        categoryId: categoryData.category || record.category,
      });

      record.calculatorData = result.calculatorData;

      record.grandScore = result.grandScore;

      record.totalBaseValue = result.totalBaseValue;
    }

    await record.save();

    const updated = await populateRecord(NumberCal.findById(record._id));

    return res.status(200).json({
      success: true,

      message: "Record updated successfully.",

      data: updated,
    });
  } catch (error) {
    console.error("UPDATE NUMBER CAL ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Unable to update record.",
    });
  }
};

/* =========================================================
   DELETE
========================================================= */

export const deleteNumberCal = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,

        message: "Invalid record ID.",
      });
    }

    const deleted = await NumberCal.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,

        message: "Record not found.",
      });
    }

    return res.status(200).json({
      success: true,

      message: "Record deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE NUMBER CAL ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Unable to delete record.",
    });
  }
};
