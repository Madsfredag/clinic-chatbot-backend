import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import type { TenantConfig } from "../config/tenants.js";
import { getTenantByClientId  } from "../config/tenants.js";
import { createHmacSha256, safeCompareHex } from "../utils/hmac.js";

type VerifiedTenantRequest = Request & {
  tenant?: TenantConfig;
};

function isTimestampValid(timestamp: string): boolean {
  const parsed = Number(timestamp);

  if (!Number.isFinite(parsed)) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const diff = Math.abs(nowSeconds - parsed);

  return diff <= env.ALLOWED_TIMESTAMP_SKEW_SECONDS;
}

export function verifySignature(
  req: VerifiedTenantRequest,
  res: Response,
  next: NextFunction,
) {
  const clientId = req.header("X-Client-Id");
  const timestamp = req.header("X-Timestamp");
  const signature = req.header("X-Signature");

  if (!clientId || !timestamp || !signature) {
    return res.status(401).json({
      error: "Missing authentication headers",
    });
  }

  if (!isTimestampValid(timestamp)) {
    return res.status(401).json({
      error: "Invalid or expired timestamp",
    });
  }

  const tenant = getTenantByClientId(clientId);

  if (!tenant) {
    return res.status(401).json({
      error: "Unknown client",
    });
  }

  const bodyString = JSON.stringify(req.body ?? {});
  const signedPayload = `${timestamp}.${bodyString}`;
  const expectedSignature = createHmacSha256(signedPayload, tenant.clientSecret);

  if (!safeCompareHex(signature, expectedSignature)) {
    return res.status(401).json({
      error: "Invalid signature",
    });
  }

  req.tenant = tenant;
  next();
}