import { BASE_CURRENCY, RATES_FILE, loadRates, supportedCurrencies } from "./rates.js";

/**
 * A deterministic stand-in for a tool-calling model.
 *
 * The flow is split into the same four stages a real agent would go through,
 * and every stage returns its own inspectable payload so a wrong answer can be
 * traced to the exact step that produced it:
 *
 *   1. Model Decision       -> what the model understood and whether it calls a tool
 *   2. Tool Call Arguments  -> the arguments handed to the currency lookup
 *   3. Tool Result          -> what the lookup read back out of data/rates.json
 *   4. Final Answer         -> the formatted sentence shown to the user
 */

// "Convert 100 USD to JPY", "how much is 1,250.5 usd in kwd", "100 USD -> INR"
const CONVERSION_PATTERN =
  /(-?\d[\d,]*(?:\.\d+)?)\s*([A-Za-z]{3})\b[\s,]*(?:to|in|into|as|->|=>|→)\s*([A-Za-z]{3})\b/i;

function parseAmount(raw) {
  return Number(raw.replace(/,/g, ""));
}

// Round half-up at the configured precision. The epsilon nudge keeps binary
// floating point noise (100 * 0.31 = 31.000000000000004) from changing a digit.
function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON * Math.abs(value)) * factor) / factor;
}

function formatAmount(value, decimals) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// The cross rate is informational, not an amount in either currency, so it is
// shown at up to 6 decimals with trailing zeros trimmed (157, 0.31, 0.336957).
function formatRate(value) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(value);
}

// ---------------------------------------------------------------- stage 1
function decide(question) {
  const text = (question || "").trim();

  if (!text) {
    return {
      intent: "none",
      call_tool: false,
      reason: "No question was entered, so there is nothing to look up.",
    };
  }

  const match = text.match(CONVERSION_PATTERN);

  if (!match) {
    return {
      intent: "unknown",
      call_tool: false,
      reason:
        "Could not find an <amount> <FROM> to <TO> pattern in the question, " +
        "so no currency lookup is made. Try: Convert 100 USD to JPY",
      question: text,
    };
  }

  const amount = parseAmount(match[1]);
  const from = match[2].toUpperCase();
  const to = match[3].toUpperCase();

  return {
    intent: "convert_currency",
    call_tool: true,
    tool: "lookup_rate",
    reason:
      `Recognised a conversion request: ${amount} ${from} into ${to}. ` +
      `Calling the lookup_rate tool because the rates live in ${RATES_FILE}, not in the model.`,
    understood: { amount, from_currency: from, to_currency: to },
    question: text,
  };
}

// ---------------------------------------------------------------- stage 2
function buildToolArguments(decision) {
  return {
    tool: decision.tool,
    arguments: {
      amount: decision.understood.amount,
      from: decision.understood.from_currency,
      to: decision.understood.to_currency,
    },
  };
}

// ---------------------------------------------------------------- stage 3
function lookupRate({ amount, from, to }) {
  const rates = loadRates();
  const known = Object.keys(rates);

  const missing = [from, to].filter((code) => !Object.hasOwn(rates, code));
  if (missing.length > 0) {
    return {
      ok: false,
      source: RATES_FILE,
      error: `Unsupported currency code: ${missing.join(", ")}`,
      supported_currencies: known,
    };
  }

  if (!Number.isFinite(amount)) {
    return {
      ok: false,
      source: RATES_FILE,
      error: `Amount "${amount}" is not a usable number.`,
    };
  }

  const fromEntry = rates[from];
  const toEntry = rates[to];

  // Everything is quoted against USD, so convert to the base first and then out
  // of it. This keeps every currency pair consistent, including pairs that do
  // not involve USD at all (e.g. EUR -> KWD).
  const amount_in_base = amount / fromEntry.rate;
  const converted_raw = amount_in_base * toEntry.rate;

  return {
    ok: true,
    source: RATES_FILE,
    base_currency: BASE_CURRENCY,
    from: { code: from, rate_per_usd: fromEntry.rate, decimals: fromEntry.decimals },
    to: { code: to, rate_per_usd: toEntry.rate, decimals: toEntry.decimals },
    cross_rate: toEntry.rate / fromEntry.rate,
    amount_in_base,
    converted_raw,
  };
}

// ---------------------------------------------------------------- stage 4
function buildFinalAnswer(args, result) {
  if (!result.ok) {
    return {
      text: `Could not convert: ${result.error}`,
      error: true,
    };
  }

  // Decimal places are read from the target currency's entry in data/rates.json,
  // never hard-coded per currency here.
  const decimals = result.to.decimals;
  const rounded = roundTo(result.converted_raw, decimals);

  const sourceText = `${formatAmount(args.amount, result.from.decimals)} ${result.from.code}`;
  const targetText = `${formatAmount(rounded, decimals)} ${result.to.code}`;
  const rateText = `1 ${result.from.code} = ${formatRate(result.cross_rate)} ${result.to.code}`;

  return {
    text: `${sourceText} = ${targetText}`,
    error: false,
    rounded_value: rounded,
    decimals_used: decimals,
    decimals_source: `${RATES_FILE} -> ${result.to.code}.decimals`,
    rate_used: rateText,
  };
}

// ---------------------------------------------------------------- pipeline
export function runAgent(question) {
  const modelDecision = decide(question);

  if (!modelDecision.call_tool) {
    return {
      question: (question || "").trim(),
      modelDecision,
      toolCallArguments: null,
      toolResult: null,
      finalAnswer: {
        text:
          modelDecision.intent === "none"
            ? "Enter a question such as: Convert 100 USD to JPY"
            : "I could not read an amount and two currency codes from that question.",
        error: modelDecision.intent !== "none",
      },
    };
  }

  const toolCallArguments = buildToolArguments(modelDecision);
  const toolResult = lookupRate(toolCallArguments.arguments);
  const finalAnswer = buildFinalAnswer(toolCallArguments.arguments, toolResult);

  return {
    question: modelDecision.question,
    modelDecision,
    toolCallArguments,
    toolResult,
    finalAnswer,
  };
}

export { supportedCurrencies };
