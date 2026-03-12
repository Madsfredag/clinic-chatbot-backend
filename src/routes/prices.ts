import { Router } from "express";
import multer from "multer";
import { verifySignature } from "../middleware/verifySignature.js";
import {
  parseCsv,
  saveClinicPriceTable,
} from "../services/priceService.js";

export const pricesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
});

pricesRouter.post(
  "/",
  verifySignature,
  upload.single("file"),
  async (req, res, next) => {
    try {
      const tenant = req.tenant;

      if (!tenant) {
        return res.status(500).json({
          error: "Tenant resolution failed",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "CSV file is required",
        });
      }

      const csvContent = req.file.buffer.toString("utf8");

      const table = parseCsv(csvContent);

      await saveClinicPriceTable(tenant.clinicId, table);

      return res.status(200).json({
        success: true,
        rowsStored: table.rows.length,
      });
    } catch (error) {
      next(error);
    }
  }
);