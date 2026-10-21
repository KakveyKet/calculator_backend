import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      minlength: [2, "Category name must contain at least 2 characters"],
      maxlength: [100, "Category name cannot exceed 100 characters"],
    },

    number: {
      type: Number,
      required: [true, "Category number is required"],
      min: [1, "Category number must be at least 1"],
    },
  },
  {
    timestamps: true,
  },
);

/*
|--------------------------------------------------------------------------
| UNIQUE CATEGORY NAME
|--------------------------------------------------------------------------
*/

categorySchema.index(
  {
    name: 1,
  },
  {
    unique: true,
  },
);

/*
|--------------------------------------------------------------------------
| JSON OUTPUT
|--------------------------------------------------------------------------
*/

categorySchema.set("toJSON", {
  transform(document, returnedObject) {
    delete returnedObject.__v;

    return returnedObject;
  },
});

const Category =
  mongoose.models.Category || mongoose.model("Category", categorySchema);

export default Category;
