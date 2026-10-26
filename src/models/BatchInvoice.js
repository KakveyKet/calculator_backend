import mongoose from "mongoose";

const { Schema } = mongoose;

/* =====================================================
   ENTRY
===================================================== */

const lineSchema = new Schema(
  {
    raw: {
      type: String,
      required: true,
      trim: true,
    },

    baseValue: {
      type: Number,
      required: true,
    },

    score: {
      type: Number,
      required: true,
    },

    number: String,
    prefix: String,
    endNumber: String,
    digitLength: Number,
    signWeight: Number,
    subCategoryTotal: Number,
  },
  {
    _id: false,
  },
);

/* =====================================================
   SUBCATEGORY SELECTION GROUP
===================================================== */

const subGroupSchema = new Schema(
  {
    /*
      NEW:
      One group can contain multiple subcategories.
    */
    subCategories: [
      {
        type: Schema.Types.ObjectId,
        ref: "SubCategory",
      },
    ],

    subCategoryNames: {
      type: [String],
      default: [],
    },

    /*
      Keep these optional fields to read previously
      saved single-subcategory groups.
    */
    subCategory: {
      type: Schema.Types.ObjectId,
      ref: "SubCategory",
    },

    subCategoryName: String,

    calculatorData: {
      type: [lineSchema],
      required: true,
    },

    groupScore: {
      type: Number,
      required: true,
    },

    totalBaseValue: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: true,
  },
);

/* =====================================================
   MAIN CATEGORY
===================================================== */

const mainGroupSchema = new Schema(
  {
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    categoryName: {
      type: String,
      required: true,
      trim: true,
    },

    subGroups: {
      type: [subGroupSchema],
      default: [],
    },

    /*
      Compatibility with older flat invoices.
    */
    subCategories: [
      {
        type: Schema.Types.ObjectId,
        ref: "SubCategory",
      },
    ],

    subCategoryNames: {
      type: [String],
      default: [],
    },

    calculatorData: {
      type: [lineSchema],
      default: [],
    },

    groupScore: {
      type: Number,
      required: true,
    },

    totalBaseValue: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: true,
  },
);

/* =====================================================
   INVOICE
===================================================== */

const batchInvoiceSchema = new Schema(
  {
    groups: {
      type: [mainGroupSchema],
      required: true,
      validate: {
        validator: (groups) => Array.isArray(groups) && groups.length > 0,
        message: "Invoice requires at least one category.",
      },
    },

    grandScore: {
      type: Number,
      required: true,
    },

    totalBaseValue: {
      type: Number,
      default: 0,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "batch_invoices",
  },
);

batchInvoiceSchema.index({ createdAt: -1 });
batchInvoiceSchema.index({
  createdBy: 1,
  createdAt: -1,
});

export default mongoose.models.BatchInvoice ||
  mongoose.model("BatchInvoice", batchInvoiceSchema);
