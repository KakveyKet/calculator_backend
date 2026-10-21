import mongoose from "mongoose";

const subCategorySchema = new mongoose.Schema(
  {
    /* =====================================================
         CATEGORY
      ===================================================== */

    category: {
      type: mongoose.Schema.Types.ObjectId,

      ref: "Category",

      required: [true, "Category is required"],

      index: true,
    },

    /* =====================================================
         NAME
      ===================================================== */

    name: {
      type: String,

      required: [true, "Sub category name is required"],

      trim: true,

      minlength: [1, "Sub category name is required"],

      maxlength: [100, "Sub category name cannot exceed 100 characters"],
    },

    /* =====================================================
         2 DIGIT NUMBER

         Example:

         Input: 12x

         This value will be used.
      ===================================================== */

    number2Digit: {
      type: Number,

      required: [true, "2 digit number is required"],

      min: [1, "2 digit number must be at least 1"],
    },

    /* =====================================================
         3 DIGIT NUMBER

         Example:

         Input: 123x

         This value will be used.
      ===================================================== */

    number3Digit: {
      type: Number,

      required: [true, "3 digit number is required"],

      min: [1, "3 digit number must be at least 1"],
    },
  },

  {
    timestamps: true,
  },
);

/* =========================================================
   UNIQUE NAME INSIDE SAME CATEGORY
========================================================= */

subCategorySchema.index(
  {
    category: 1,
    name: 1,
  },

  {
    unique: true,
  },
);

/* =========================================================
   JSON
========================================================= */

subCategorySchema.set("toJSON", {
  transform(document, returnedObject) {
    delete returnedObject.__v;

    return returnedObject;
  },
});

/* =========================================================
   MODEL
========================================================= */

const SubCategory =
  mongoose.models.SubCategory ||
  mongoose.model("SubCategory", subCategorySchema);

export default SubCategory;
