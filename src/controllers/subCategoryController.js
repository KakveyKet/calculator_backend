import mongoose from "mongoose";

import Category from "../models/Category.js";
import SubCategory from "../models/SubCategory.js";

/* =========================================================
   ESCAPE REGEX
========================================================= */

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* =========================================================
   VALIDATE CATEGORY
========================================================= */

async function validateCategory(categoryId) {
  if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new Error("Invalid category.");
  }

  const category = await Category.findById(categoryId);

  if (!category) {
    throw new Error("Category not found.");
  }

  return category;
}

/* =========================================================
   VALIDATE NUMBER
========================================================= */

function validateNumber(value, label) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 1) {
    throw new Error(`${label} must be at least 1.`);
  }

  return number;
}

/* =========================================================
   CREATE
========================================================= */

export const createSubCategory = async (req, res) => {
  try {
    const { category, name, number2Digit, number3Digit } = req.body;

    const categoryDocument = await validateCategory(category);

    const cleanName = String(name || "").trim();

    if (!cleanName) {
      return res.status(400).json({
        success: false,

        message: "Sub category name is required.",
      });
    }

    const cleanNumber2Digit = validateNumber(number2Digit, "2 digit number");

    const cleanNumber3Digit = validateNumber(number3Digit, "3 digit number");

    /* =====================================================
         DUPLICATE
      ===================================================== */

    const existing = await SubCategory.findOne({
      category: categoryDocument._id,

      name: {
        $regex: new RegExp(`^${escapeRegex(cleanName)}$`, "i"),
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,

        message: "This sub category already exists in the selected category.",
      });
    }

    /* =====================================================
         CREATE
      ===================================================== */

    const subCategory = await SubCategory.create({
      category: categoryDocument._id,

      name: cleanName,

      number2Digit: cleanNumber2Digit,

      number3Digit: cleanNumber3Digit,
    });

    await subCategory.populate("category", "name number");

    return res.status(201).json({
      success: true,

      message: "Sub category created successfully.",

      data: subCategory,
    });
  } catch (error) {
    console.error("CREATE SUB CATEGORY ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,

        message: "This sub category already exists.",
      });
    }

    return res.status(400).json({
      success: false,

      message: error.message || "Unable to create sub category.",
    });
  }
};

/* =========================================================
   GET ALL
========================================================= */

export const getSubCategories = async (req, res) => {
  try {
    const query = {};

    if (req.query.category) {
      if (!mongoose.Types.ObjectId.isValid(req.query.category)) {
        return res.status(400).json({
          success: false,

          message: "Invalid category ID.",
        });
      }

      query.category = req.query.category;
    }

    if (req.query.search) {
      query.name = {
        $regex: String(req.query.search).trim(),

        $options: "i",
      };
    }

    const subCategories = await SubCategory.find(query)
      .populate("category", "name number")
      .sort({
        name: 1,
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,

      data: subCategories,
    });
  } catch (error) {
    console.error("GET SUB CATEGORIES ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Unable to load sub categories.",
    });
  }
};

/* =========================================================
   GET ONE
========================================================= */

export const getSubCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,

        message: "Invalid sub category ID.",
      });
    }

    const subCategory = await SubCategory.findById(id).populate(
      "category",
      "name number",
    );

    if (!subCategory) {
      return res.status(404).json({
        success: false,

        message: "Sub category not found.",
      });
    }

    return res.status(200).json({
      success: true,

      data: subCategory,
    });
  } catch (error) {
    console.error("GET SUB CATEGORY ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Unable to load sub category.",
    });
  }
};

/* =========================================================
   UPDATE
========================================================= */

export const updateSubCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,

        message: "Invalid sub category ID.",
      });
    }

    const subCategory = await SubCategory.findById(id);

    if (!subCategory) {
      return res.status(404).json({
        success: false,

        message: "Sub category not found.",
      });
    }

    const categoryId = req.body.category ?? subCategory.category;

    const category = await validateCategory(categoryId);

    const cleanName = String(req.body.name ?? subCategory.name).trim();

    if (!cleanName) {
      return res.status(400).json({
        success: false,

        message: "Sub category name is required.",
      });
    }

    const cleanNumber2Digit = validateNumber(
      req.body.number2Digit ?? subCategory.number2Digit,

      "2 digit number",
    );

    const cleanNumber3Digit = validateNumber(
      req.body.number3Digit ?? subCategory.number3Digit,

      "3 digit number",
    );

    /* =====================================================
         DUPLICATE
      ===================================================== */

    const existing = await SubCategory.findOne({
      _id: {
        $ne: subCategory._id,
      },

      category: category._id,

      name: {
        $regex: new RegExp(`^${escapeRegex(cleanName)}$`, "i"),
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,

        message: "This sub category already exists in the selected category.",
      });
    }

    /* =====================================================
         UPDATE
      ===================================================== */

    subCategory.category = category._id;

    subCategory.name = cleanName;

    subCategory.number2Digit = cleanNumber2Digit;

    subCategory.number3Digit = cleanNumber3Digit;

    await subCategory.save();

    await subCategory.populate("category", "name number");

    return res.status(200).json({
      success: true,

      message: "Sub category updated successfully.",

      data: subCategory,
    });
  } catch (error) {
    console.error("UPDATE SUB CATEGORY ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,

        message: "This sub category already exists.",
      });
    }

    return res.status(400).json({
      success: false,

      message: error.message || "Unable to update sub category.",
    });
  }
};

/* =========================================================
   DELETE
========================================================= */

export const deleteSubCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,

        message: "Invalid sub category ID.",
      });
    }

    const subCategory = await SubCategory.findById(id);

    if (!subCategory) {
      return res.status(404).json({
        success: false,

        message: "Sub category not found.",
      });
    }

    await subCategory.deleteOne();

    return res.status(200).json({
      success: true,

      message: "Sub category deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE SUB CATEGORY ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Unable to delete sub category.",
    });
  }
};
