import assert from "node:assert/strict";
import test from "node:test";

import { Currency, Level, SalaryPeriod } from "@prisma/client";

import { normalizeCompanyName, normalizeRole } from "../src/utils/normalize";
import {
  annualizeBaseSalary,
  calculateTotalCompensation,
} from "../src/utils/salary";
import { validateCompensationPayload } from "../src/validators/compensation.validator";

const validPayload = {
  company: "Google",
  role: "Backend Engineer",
  level: Level.L1,
  city: "Bengaluru",
  state: "Karnataka",
  country: "India",
  currency: Currency.INR,
  salaryPeriod: SalaryPeriod.MONTHLY,
  baseSalary: 100_000,
  yearsOfExperience: 1.5,
};

test("normalization canonicalizes whitespace and case without fuzzy matching", () => {
  assert.equal(normalizeCompanyName("  Google   India  "), "google india");
  assert.equal(normalizeCompanyName("Google LLC"), "google llc");
  assert.equal(normalizeRole("  Backend   Engineer "), "backend engineer");
  assert.notEqual(normalizeRole("SDE"), normalizeRole("Software Engineer"));
});

test("salary helpers annualize monthly pay and preserve Decimal arithmetic", () => {
  assert.equal(
    annualizeBaseSalary(100_000, SalaryPeriod.MONTHLY).toString(),
    "1200000",
  );
  assert.equal(
    annualizeBaseSalary(1_200_000, SalaryPeriod.ANNUAL).toString(),
    "1200000",
  );
  assert.equal(
    calculateTotalCompensation("1200000", "200000", "300000").toString(),
    "1700000",
  );
});

test("compensation validation returns a typed payload and defaults omitted bonus and stock", () => {
  const result = validateCompensationPayload(validPayload);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.bonus, 0);
    assert.equal(result.data.stock, 0);
    assert.equal(result.data.yearsOfExperience, 1.5);
  }
});

test("compensation validation rejects required-field, range, enum, and non-finite failures", () => {
  const invalidPayloads: unknown[] = [
    { ...validPayload, company: "   " },
    { ...validPayload, baseSalary: 0 },
    { ...validPayload, baseSalary: -1 },
    { ...validPayload, bonus: -1 },
    { ...validPayload, stock: -1 },
    { ...validPayload, yearsOfExperience: 50.1 },
    { ...validPayload, yearsOfExperience: Number.NaN },
    { ...validPayload, baseSalary: Number.POSITIVE_INFINITY },
    { ...validPayload, level: "L4" },
    { ...validPayload, currency: "EUR" },
    { ...validPayload, salaryPeriod: "WEEKLY" },
  ];

  for (const payload of invalidPayloads) {
    const result = validateCompensationPayload(payload);
    assert.equal(result.ok, false);
  }
});
