import { Router } from "express";
import { verifySignature } from "../middleware/verifySignature.js";
import {
  normalizePriceWorkbook,
  saveClinicPriceWorkbook,
} from "../services/priceService.js";

export const pricesRouter = Router();

pricesRouter.post("/", verifySignature, async (req, res, next) => {
  try {
    const tenant = req.tenant;

    if (!tenant) {
      return res.status(500).json({
        error: "Tenant resolution failed",
      });
    }

    const workbook = normalizePriceWorkbook(req.body);

    if (!workbook) {
      return res.status(400).json({
        error: "Invalid payload. Expected { sheets: { ... } }",
      });
    }

    await saveClinicPriceWorkbook(tenant.clinicId, workbook);

    const rowsStored = Object.values(workbook.sheets).reduce(
      (sum, sheet) => sum + sheet.rows.length,
      0
    );

    return res.status(200).json({
      success: true,
      sheetsStored: Object.keys(workbook.sheets).length,
      rowsStored,
    });
  } catch (error) {
    next(error);
  }
});