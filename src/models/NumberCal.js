import mongoose from "mongoose";

/* =========================================================
   CALCULATOR ROW
========================================================= */

const calculatorItemSchema = new mongoose.Schema(
  {
    raw: {
      type: String,
      trim: true,
      default: "",
    },

    number: {
      type: String,
      trim: true,
      default: "",
    },

    prefix: {
      type: String,
      enum: [">", "x", ":"],
      default: ":",
    },

    endNumber: {
      type: String,
      trim: true,
      default: "",
    },

    digitLength: {
      type: Number,
      default: 0,
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    baseValue: {
      type: Number,
      default: 0,
    },

    subCategoryTotal: {
      type: Number,
      default: 0,
    },

    signWeight: {
      type: Number,
      default: 1,
    },

    score: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: true,
  },
);

/* =========================================================
   NUMBER CAL
========================================================= */

const numberCalSchema = new mongoose.Schema(
  {
    /* =====================================================
       CATEGORY
    ===================================================== */

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },

    categoryName: {
      type: String,
      trim: true,
      default: "",
    },

    /*
     * Keep this for compatibility with
     * older saved records.
     */
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    /* =====================================================
       SUB CATEGORIES
    ===================================================== */

    subCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SubCategory",
      },
    ],

    /* =====================================================
       CALCULATOR
    ===================================================== */

    calculatorData: {
      type: [calculatorItemSchema],
      default: [],
    },

    /* =====================================================
       TOTAL
    ===================================================== */

    grandScore: {
      type: Number,
      default: 0,
    },

    totalBaseValue: {
      type: Number,
      default: 0,
    },

    /* =====================================================
       USER
    ===================================================== */

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

/* =========================================================
   INDEX
========================================================= */

numberCalSchema.index({
  createdAt: -1,
});

numberCalSchema.index({
  category: 1,
  createdAt: -1,
});

/* =========================================================
   JSON
========================================================= */

numberCalSchema.set("toJSON", {
  transform(document, returnedObject) {
    delete returnedObject.__v;

    return returnedObject;
  },
});

/* =========================================================
   MODEL
========================================================= */

const NumberCal =
  mongoose.models.NumberCal || mongoose.model("NumberCal", numberCalSchema);

export default NumberCal;
