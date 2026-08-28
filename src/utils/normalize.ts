export function normalizeText(value: string): string {
  // Preserve meaningful words while making case and incidental whitespace irrelevant to identity matching
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

// Company identity deliberately does not remove legal suffixes or apply fuzzy matching
// Becomes complicated --> not needed for this assignment
export function normalizeCompanyName(company: string): string {
  return normalizeText(company);
}

// Roles use the same exact-match normalization 
export function normalizeRole(role: string): string {
  return normalizeText(role);
}
