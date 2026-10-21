import express from "express";

import {
  createCategory,
  deleteCategory,
  getCategoryById,
  getCategories,
  updateCategory,
} from "../controllers/categoryController.js";

import { authenticate } from "../middleware/authMiddleware.js";

import {
  requireAnyModule,
  requireModule,
} from "../middleware/modulePermissionMiddleware.js";

const router = express.Router();

/* =========================================================
   READ

   Calculator needs category data even when
   the user does not have Category Management.
========================================================= */

router.get(
  "/",
  authenticate,
  requireAnyModule("CALCULATOR", "CATEGORIES", "SUB_CATEGORIES"),
  getCategories,
);

router.get(
  "/:id",
  authenticate,
  requireAnyModule("CALCULATOR", "CATEGORIES", "SUB_CATEGORIES"),
  getCategoryById,
);

/* =========================================================
   MANAGEMENT
========================================================= */

router.post("/", authenticate, requireModule("CATEGORIES"), createCategory);

router.put("/:id", authenticate, requireModule("CATEGORIES"), updateCategory);

router.delete(
  "/:id",
  authenticate,
  requireModule("CATEGORIES"),
  deleteCategory,
);

export default router;
