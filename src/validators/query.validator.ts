import { Currency, Level } from "@prisma/client";

import {
  type ValidationResult,
  validationFailure,
} from "./compensation.validator";

const levelValues = Object.values(Level) as Level[];
const currencyValues = Object.values(Currency) as Currency[];
const sortByValues = [
  "totalCompensation",
  "annualBaseSalary",
  "yearsOfExperience",
  "createdAt",
] as const;
const orderValues = ["asc", "desc"] as const;

export type CompensationSortBy = (typeof sortByValues)[number];
export type SortOrder = (typeof orderValues)[number];

export type ValidatedCompensationSearchQuery = {
  company?: string;
  role?: string;
  level?: Level;
  city?: string;
  state?: string;
  country?: string;
  currency?: Currency;
  minBaseSalary?: number;
  maxBaseSalary?: number;
  minExperience?: number;
  maxExperience?: number;
  sortBy?: CompensationSortBy;
  order?: SortOrder;
  page: number;
  limit: number;
};

export type ValidatedCompanyAggregationQuery = {
  currency: Currency;
  role?: string;
  city?: string;
  state?: string;
  country?: string;
};

export type ValidatedCompanyComparisonQuery = {
  companies: string[];
  currency: Currency;
  role?: string;
  level?: Level;
  city?: string;
  state?: string;
  country?: string;
};

function validationSuccess<T>(data: T): ValidationResult<T> {
  return { ok: true, data };
}

function parseOptionalText(
  query: URLSearchParams,
  field: string,
): ValidationResult<string | undefined> {
  const value = query.get(field);

  if (value === null) {
    return validationSuccess(undefined);
  }

  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return validationFailure(`${field} must be a non-empty string when provided.`);
  }

  return validationSuccess(trimmedValue);
}

function parseOptionalEnum<T extends string>(
  query: URLSearchParams,
  field: string,
  allowedValues: readonly T[],
): ValidationResult<T | undefined> {
  const value = query.get(field);

  if (value === null) {
    return validationSuccess(undefined);
  }

  if (!allowedValues.includes(value as T)) {
    return validationFailure(`${field} has an invalid value.`);
  }

  return validationSuccess(value as T);
}

function parseRequiredEnum<T extends string>(
  query: URLSearchParams,
  field: string,
  allowedValues: readonly T[],
): ValidationResult<T> {
  const value = query.get(field);

  if (value === null || !allowedValues.includes(value as T)) {
    return validationFailure(`${field} has an invalid value.`);
  }

  return validationSuccess(value as T);
}

function parseOptionalNumber(
  query: URLSearchParams,
  field: string,
  minimum: number,
  maximum?: number,
): ValidationResult<number | undefined> {
  const value = query.get(field);

  if (value === null) {
    return validationSuccess(undefined);
  }

  if (value.trim().length === 0) {
    return validationFailure(`${field} must be a finite number.`);
  }

  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return validationFailure(`${field} must be a finite number.`);
  }

  if (parsedValue < minimum || (maximum !== undefined && parsedValue > maximum)) {
    return validationFailure(`${field} is outside the allowed range.`);
  }

  return validationSuccess(parsedValue);
}

function parsePaginationValue(
  query: URLSearchParams,
  field: "page" | "limit",
  defaultValue: number,
  maximum?: number,
): ValidationResult<number> {
  const value = query.get(field);

  if (value === null) {
    return validationSuccess(defaultValue);
  }

  if (value.trim().length === 0) {
    return validationFailure(`${field} must be an integer.`);
  }

  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    return validationFailure(`${field} must be an integer greater than or equal to 1.`);
  }

  if (maximum !== undefined && parsedValue > maximum) {
    return validationFailure(`${field} cannot be greater than ${maximum}.`);
  }

  return validationSuccess(parsedValue);
}

export function validateCompensationSearchQuery(
  query: URLSearchParams,
): ValidationResult<ValidatedCompensationSearchQuery> {
  const company = parseOptionalText(query, "company");
  if (!company.ok) return company;

  const role = parseOptionalText(query, "role");
  if (!role.ok) return role;

  const city = parseOptionalText(query, "city");
  if (!city.ok) return city;

  const state = parseOptionalText(query, "state");
  if (!state.ok) return state;

  const country = parseOptionalText(query, "country");
  if (!country.ok) return country;

  const level = parseOptionalEnum(query, "level", levelValues);
  if (!level.ok) return level;

  const currency = parseOptionalEnum(query, "currency", currencyValues);
  if (!currency.ok) return currency;

  const minBaseSalary = parseOptionalNumber(query, "minBaseSalary", 0);
  if (!minBaseSalary.ok) return minBaseSalary;

  const maxBaseSalary = parseOptionalNumber(query, "maxBaseSalary", 0);
  if (!maxBaseSalary.ok) return maxBaseSalary;

  if (
    minBaseSalary.data !== undefined &&
    maxBaseSalary.data !== undefined &&
    minBaseSalary.data > maxBaseSalary.data
  ) {
    return validationFailure("minBaseSalary cannot be greater than maxBaseSalary.");
  }

  const minExperience = parseOptionalNumber(query, "minExperience", 0, 50);
  if (!minExperience.ok) return minExperience;

  const maxExperience = parseOptionalNumber(query, "maxExperience", 0, 50);
  if (!maxExperience.ok) return maxExperience;

  if (
    minExperience.data !== undefined &&
    maxExperience.data !== undefined &&
    minExperience.data > maxExperience.data
  ) {
    return validationFailure("minExperience cannot be greater than maxExperience.");
  }

  const sortBy = parseOptionalEnum(query, "sortBy", sortByValues);
  if (!sortBy.ok) return sortBy;

  const order = parseOptionalEnum(query, "order", orderValues);
  if (!order.ok) return order;

  const page = parsePaginationValue(query, "page", 1);
  if (!page.ok) return page;

  const limit = parsePaginationValue(query, "limit", 20, 100);
  if (!limit.ok) return limit;

  return validationSuccess({
    company: company.data,
    role: role.data,
    level: level.data,
    city: city.data,
    state: state.data,
    country: country.data,
    currency: currency.data,
    minBaseSalary: minBaseSalary.data,
    maxBaseSalary: maxBaseSalary.data,
    minExperience: minExperience.data,
    maxExperience: maxExperience.data,
    sortBy: sortBy.data,
    order: order.data,
    page: page.data,
    limit: limit.data,
  });
}

export function validateCompanyAggregationQuery(
  query: URLSearchParams,
): ValidationResult<ValidatedCompanyAggregationQuery> {
  const currency = parseRequiredEnum(query, "currency", currencyValues);
  if (!currency.ok) return currency;

  const role = parseOptionalText(query, "role");
  if (!role.ok) return role;

  const city = parseOptionalText(query, "city");
  if (!city.ok) return city;

  const state = parseOptionalText(query, "state");
  if (!state.ok) return state;

  const country = parseOptionalText(query, "country");
  if (!country.ok) return country;

  return validationSuccess({
    currency: currency.data,
    role: role.data,
    city: city.data,
    state: state.data,
    country: country.data,
  });
}

export function validateCompanyComparisonQuery(
  query: URLSearchParams,
): ValidationResult<ValidatedCompanyComparisonQuery> {
  const companiesValue = query.get("companies");
  if (companiesValue === null) {
    return validationFailure("companies is required.");
  }

  const companies = companiesValue.split(",").map((company) => company.trim());
  if (companies.some((company) => company.length === 0)) {
    return validationFailure("companies cannot contain empty names.");
  }

  if (companies.length < 2 || companies.length > 5) {
    return validationFailure("companies must contain between 2 and 5 names.");
  }

  if (new Set(companies).size !== companies.length) {
    return validationFailure("companies cannot contain duplicate names.");
  }

  const currency = parseRequiredEnum(query, "currency", currencyValues);
  if (!currency.ok) return currency;

  const role = parseOptionalText(query, "role");
  if (!role.ok) return role;

  const level = parseOptionalEnum(query, "level", levelValues);
  if (!level.ok) return level;

  const city = parseOptionalText(query, "city");
  if (!city.ok) return city;

  const state = parseOptionalText(query, "state");
  if (!state.ok) return state;

  const country = parseOptionalText(query, "country");
  if (!country.ok) return country;

  return validationSuccess({
    companies,
    currency: currency.data,
    role: role.data,
    level: level.data,
    city: city.data,
    state: state.data,
    country: country.data,
  });
}
