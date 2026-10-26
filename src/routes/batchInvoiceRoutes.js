import { Router } from "express";

import { authenticate } from "../middleware/authMiddleware.js";

import {
  createBatchInvoice,
  listBatchInvoices,
  getBatchInvoice,
  deleteBatchInvoice,
} from "../controllers/batchInvoiceController.js";

const router = Router();

router.use(authenticate);

router.get("/", listBatchInvoices);

router.post("/", createBatchInvoice);

router.get("/:id", getBatchInvoice);

router.delete("/:id", deleteBatchInvoice);

export default router;
