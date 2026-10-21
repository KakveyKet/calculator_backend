import express from "express";

import {
  previewNumberCal,
  createNumberCal,
  getNumberCals,
  getNumberCalById,
  updateNumberCal,
  deleteNumberCal,
} from "../controllers/numberCalController.js";

import { authenticate } from "../middleware/authMiddleware.js";

import { requireModule } from "../middleware/modulePermissionMiddleware.js";

const router = express.Router();

/* =========================================================
   PREVIEW
========================================================= */

router.post(
  "/preview",

  authenticate,

  requireModule("CALCULATOR"),

  previewNumberCal,
);

/* =========================================================
   SAVE
========================================================= */

router.post(
  "/",

  authenticate,

  requireModule("CALCULATOR"),

  createNumberCal,
);

/* =========================================================
   INVOICES
========================================================= */

router.get(
  "/",

  authenticate,

  requireModule("INVOICES"),

  getNumberCals,
);

/* =========================================================
   DETAIL
========================================================= */

router.get(
  "/:id",

  authenticate,

  requireModule("INVOICES"),

  getNumberCalById,
);

/* =========================================================
   UPDATE
========================================================= */

router.put(
  "/:id",

  authenticate,

  requireModule("INVOICES"),

  updateNumberCal,
);

/* =========================================================
   DELETE
========================================================= */

router.delete(
  "/:id",

  authenticate,

  requireModule("INVOICES"),

  deleteNumberCal,
);

export default router;
