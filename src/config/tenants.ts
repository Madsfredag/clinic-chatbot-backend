export type TenantConfig = {
  clientId: string;
  clientSecret: string;
  clinicId: string;
  clinicName: string;
  phone: string;
  address: string;
  bookingUrl: string;
};

const tenants: Record<string, TenantConfig> = {
  "clinic-site-aarhus": {
    clientId: "clinic-site-aarhus",
    clientSecret: "replace-with-aarhus-secret",
    clinicId: "aarhus",
    clinicName: "Aarhus Dental Clinic",
    phone: "+45 11 22 33 44",
    address: "Example Street 1, 8000 Aarhus C",
    bookingUrl: "https://aarhus-clinic.example.com/book",
  },
  "clinic-site-odense": {
    clientId: "clinic-site-odense",
    clientSecret: "replace-with-odense-secret",
    clinicId: "odense",
    clinicName: "Odense Dental Clinic",
    phone: "+45 55 66 77 88",
    address: "Example Road 10, 5000 Odense",
    bookingUrl: "https://odense-clinic.example.com/book",
  },
};

export function getTenantByClientId(clientId: string): TenantConfig | null {
  return tenants[clientId] ?? null;
}