export function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeCompanyName(company: string): string {
  return normalizeText(company);
}

export function normalizeRole(role: string): string {
  return normalizeText(role);
}
