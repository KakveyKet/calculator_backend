import express from "express";

import { allowRoles, authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authenticate, allowRoles("SUPER_ADMIN"), (req, res) => {
  return res.json({
    success: true,
    message: "Admin route working.",
  });
});

export default router;
