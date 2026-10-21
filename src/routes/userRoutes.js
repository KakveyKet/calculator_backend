import express from "express";

import {
  createUser,
  getCurrentUser,
  getUserById,
  getUsers,
  updateUser,
  updateUserStatus,
} from "../controllers/userController.js";

import { authenticate } from "../middleware/authMiddleware.js";

import { requireModule } from "../middleware/modulePermissionMiddleware.js";

const router = express.Router();

/* =========================================================
   CURRENT USER

   MUST BE BEFORE /:id
========================================================= */

router.get("/me", authenticate, getCurrentUser);

/* =========================================================
   USERS
========================================================= */

router.get("/", authenticate, requireModule("USERS"), getUsers);

router.post("/", authenticate, requireModule("USERS"), createUser);

router.get("/:id", authenticate, requireModule("USERS"), getUserById);

router.put("/:id", authenticate, requireModule("USERS"), updateUser);

router.patch(
  "/:id/status",
  authenticate,
  requireModule("USERS"),
  updateUserStatus,
);

export default router;
