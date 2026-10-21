import Category from "../models/Category.js";

/*
|--------------------------------------------------------------------------
| CREATE CATEGORY
|--------------------------------------------------------------------------
|
| POST /api/categories
|
| {
|   "name": "Example Category",
|   "number": 10
| }
|
*/

export const createCategory = async (req, res) => {
  try {
    const { name, number } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required.",
      });
    }

    if (number === undefined || number === null || number === "") {
      return res.status(400).json({
        success: false,
        message: "Category number is required.",
      });
    }

    const existingCategory = await Category.findOne({
      name: {
        $regex: `^${name.trim()}$`,
        $options: "i",
      },
    });

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: "Category name already exists.",
      });
    }

    const category = await Category.create({
      name: name.trim(),
      number: Number(number),
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully.",
      data: category,
    });
  } catch (error) {
    console.error("CREATE CATEGORY ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Category name already exists.",
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create category.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET ALL CATEGORIES
|--------------------------------------------------------------------------
|
| GET /api/categories
|
*/

export const getCategories = async (req, res) => {
  try {
    const { search = "" } = req.query;

    const query = {};

    if (search.trim()) {
      query.name = {
        $regex: search.trim(),
        $options: "i",
      };
    }

    const categories = await Category.find(query).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("GET CATEGORIES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get categories.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET CATEGORY BY ID
|--------------------------------------------------------------------------
*/

export const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error("GET CATEGORY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get category.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE CATEGORY
|--------------------------------------------------------------------------
*/

export const updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    const { name, number } = req.body;

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Category name is required.",
        });
      }

      const duplicate = await Category.findOne({
        _id: {
          $ne: category._id,
        },

        name: {
          $regex: `^${name.trim()}$`,
          $options: "i",
        },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "Category name already exists.",
        });
      }

      category.name = name.trim();
    }

    if (number !== undefined) {
      category.number = Number(number);
    }

    await category.save();

    return res.status(200).json({
      success: true,
      message: "Category updated successfully.",
      data: category,
    });
  } catch (error) {
    console.error("UPDATE CATEGORY ERROR:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update category.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| DELETE CATEGORY
|--------------------------------------------------------------------------
*/

export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    await category.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE CATEGORY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete category.",
    });
  }
};
