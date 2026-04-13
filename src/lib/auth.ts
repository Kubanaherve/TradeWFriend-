export type UserRole = "owner" | "employee";

export interface LocalAccount {
  phone: string;
  displayName: string;
  role: UserRole;
  businessName: string;
  createdAt?: string;
}

export const PIN_LENGTH = 6;

export const normalizePhone = (phone: string) => phone.replace(/\D/g, "");

export const authEmailFromPhone = (phone: string) =>
  `${normalizePhone(phone)}@tradewfriend.local`;

export async function hashPin(pin: string, phone: string): Promise<string> {
  const encoder = new TextEncoder();
  const payload = encoder.encode(`${normalizePhone(phone)}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}