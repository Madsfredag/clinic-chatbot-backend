import { env } from "./env.js";

export interface TenantConfig {
  clientId: string;
  clientSecret: string;
  clinicId: string;
}

export const tenants: Record<string, TenantConfig> = {
  videsignersmil: {
    clientId: "videsignersmil",
    clientSecret: env.SECRET_VIDESIGNERSMIL,
    clinicId: "ans",
  },
  fortanden: {
    clientId: "fortanden",
    clientSecret: env.SECRET_FORTANDEN,
    clinicId: "aarhus",
  },
};

export function getTenantByClientId(clientId: string): TenantConfig | null {
  return tenants[clientId] ?? null;
}