# currency-agent

agentic software engineering focus

A minimal Next.js app that demonstrates a transparent currency-conversion agent flow.
Every stage of the conversion is shown on the page, so a wrong answer can be traced to
the stage that produced it.

## Run

```
npm install
npm run dev
```

Open http://localhost:3000 and enter a question such as `Convert 100 USD to JPY`.

## The four diagnostic blocks

1. **Model Decision** — what the model understood, and whether it called the tool
2. **Tool Call Arguments** — the amount and currency codes handed to the lookup
3. **Tool Result** — the rates and decimal settings read back from `data/rates.json`
4. **Final Answer** — the formatted answer, rounded using the target currency's decimals

Rates are fixed and read from [data/rates.json](data/rates.json). No external service
is used. Supported currencies: USD, EUR, GBP, JPY, INR, KWD, AED.

See [SUBMISSION.md](SUBMISSION.md) and
[currency answers escalations.md](currency%20answers%20escalations.md).
