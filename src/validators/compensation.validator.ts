import { Currency, Level, SalaryPeriod } from "@prisma/client";

export type ValidationError = {
  code: "VALIDATION_ERROR";
  message: string;
};

export type ValidationResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: ValidationError;
    };

export type ValidatedCompensationPayload = {
  company: string;
  role: string;
  level: Level;
  city: string;
  state: string;
  country: string;
  currency: Currency;
  salaryPeriod: SalaryPeriod;
  baseSalary: number;
  bonus: number;
  stock: number;
  yearsOfExperience: number;
};

const levelValues = Object.values(Level) as Level[];
const currencyValues = Object.values(Currency) as Currency[];
const salaryPeriodValues = Object.values(SalaryPeriod) as SalaryPeriod[];

export function validationFailure(message: string): ValidationResult<never> {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message,
    },
  };
}

function validationSuccess<T>(data: T): ValidationResult<T> {
  return { ok: true, data };
}

// Narrow unknown JSON into a plain object before reading user-controlled fields.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRequiredText(value: unknown, field: string): ValidationResult<string> {
  // Trimming is only for the emptiness check; display values and identity normalization are handled later.
  if (typeof value !== "string" || value.trim().length === 0) {
    return validationFailure(`${field} is required and must be a non-empty string.`);
  }

  return validationSuccess(value);
}

function parseEnum<T extends string>(
  value: unknown,
  field: string,
  allowedValues: readonly T[],
): ValidationResult<T> {
  if (typeof value !== "string" || !allowedValues.includes(value as T)) {
    return validationFailure(`${field} has an invalid value.`);
  }

  return validationSuccess(value as T);
}

function parseRequiredNumber(
  value: unknown,
  field: string,
  minimum: number,
  maximum?: number,
): ValidationResult<number> {
  // JSON can contain numbers that TypeScript accepts but the database should never receive (NaN/Infinity).
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return validationFailure(`${field} must be a finite number.`);
  }

  if (value < minimum || (maximum !== undefined && value > maximum)) {
    return validationFailure(`${field} is outside the allowed range.`);
  }

  return validationSuccess(value);
}

function parseOptionalNumber(
  value: unknown,
  field: string,
  minimum: number,
  defaultValue: number,
): ValidationResult<number> {
  if (value === undefined) {
    return validationSuccess(defaultValue);
  }

  return parseRequiredNumber(value, field, minimum);
}

export function validateCompensationPayload(
  input: unknown,
): ValidationResult<ValidatedCompensationPayload> {
  // Validation intentionally stops at type/range rules
  // normalization, salary calculations, and persistence belong elsewhere
  
  if (!isRecord(input)) {
    return validationFailure("Compensation data must be an object.");
  }

  const company = parseRequiredText(input.company, "company");
  if (!company.ok) return company;

  const role = parseRequiredText(input.role, "role");
  if (!role.ok) return role;

  const city = parseRequiredText(input.city, "city");
  if (!city.ok) return city;

  const state = parseRequiredText(input.state, "state");
  if (!state.ok) return state;

  const country = parseRequiredText(input.country, "country");
  if (!country.ok) return country;

  const level = parseEnum(input.level, "level", levelValues);
  if (!level.ok) return level;

  const currency = parseEnum(input.currency, "currency", currencyValues);
  if (!currency.ok) return currency;

  const salaryPeriod = parseEnum(
    input.salaryPeriod,
    "salaryPeriod",
    salaryPeriodValues,
  );
  if (!salaryPeriod.ok) return salaryPeriod;

  const baseSalary = parseRequiredNumber(input.baseSalary, "baseSalary", Number.MIN_VALUE);
  if (!baseSalary.ok) return baseSalary;

  const bonus = parseOptionalNumber(input.bonus, "bonus", 0, 0);
  if (!bonus.ok) return bonus;

  const stock = parseOptionalNumber(input.stock, "stock", 0, 0);
  if (!stock.ok) return stock;

  const yearsOfExperience = parseRequiredNumber(
    input.yearsOfExperience,
    "yearsOfExperience",
    0,
    50,
  );
  if (!yearsOfExperience.ok) return yearsOfExperience;

  return validationSuccess({
    company: company.data,
    role: role.data,
    level: level.data,
    city: city.data,
    state: state.data,
    country: country.data,
    currency: currency.data,
    salaryPeriod: salaryPeriod.data,
    baseSalary: baseSalary.data,
    bonus: bonus.data,
    stock: stock.data,
    yearsOfExperience: yearsOfExperience.data,
  });
}
