import fs from "node:fs";
import path from "node:path";

// All currency data comes from data/rates.json. Nothing about rates or
// decimal places is duplicated in the UI or anywhere else in the code.
export const RATES_FILE = "data/rates.json";

const RATES_PATH = path.join(process.cwd(), "data", "rates.json");

// Rates are quoted relative to USD: `rate` is how many units of the currency
// one USD buys. USD itself therefore has rate 1.
export const BASE_CURRENCY = "USD";

export function loadRates() {
  return JSON.parse(fs.readFileSync(RATES_PATH, "utf8"));
}

export function supportedCurrencies() {
  return Object.keys(loadRates());
}
