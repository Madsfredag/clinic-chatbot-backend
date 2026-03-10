import { TenantConfig } from "../config/tenants";

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantConfig;
    }
  }
}

export {};