import express from "express";

import {
  createSubCategory,
  deleteSubCategory,
  getSubCategoryById,
  getSubCategories,
  updateSubCategory,
} from "../controllers/subCategoryController.js";

import { authenticate } from "../middleware/authMiddleware.js";

import {
  requireAnyModule,
  requireModule,
} from "../middleware/modulePermissionMiddleware.js";

const router = express.Router();

/* =========================================================
   READ

   Calculator needs SubCategories.
========================================================= */

router.get(
  "/",
  authenticate,
  requireAnyModule("CALCULATOR", "SUB_CATEGORIES"),
  getSubCategories,
);

router.get(
  "/:id",
  authenticate,
  requireAnyModule("CALCULATOR", "SUB_CATEGORIES"),
  getSubCategoryById,
);

/* =========================================================
   MANAGEMENT
========================================================= */

router.post(
  "/",
  authenticate,
  requireModule("SUB_CATEGORIES"),
  createSubCategory,
);

router.put(
  "/:id",
  authenticate,
  requireModule("SUB_CATEGORIES"),
  updateSubCategory,
);

router.delete(
  "/:id",
  authenticate,
  requireModule("SUB_CATEGORIES"),
  deleteSubCategory,
);

export default router;
