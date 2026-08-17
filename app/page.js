import { runAgent, supportedCurrencies } from "../lib/agent.js";

const EXAMPLE = "Convert 100 USD to JPY";

function Block({ index, label, note, children, className = "" }) {
  return (
    <section className={`block ${className}`}>
      <h2 className="block-label">
        <span className="block-index">{index}.</span>
        {label}
      </h2>
      <p className="block-note">{note}</p>
      {children}
    </section>
  );
}

const NOT_RUN = "Not run yet — ask a question above.";
const NO_TOOL_CALL =
  "No tool call — the model did not call the currency lookup for this question (see Model Decision).";

function Output({ value, placeholder = NOT_RUN }) {
  if (value === null || value === undefined) {
    return <pre className="block-output empty">{placeholder}</pre>;
  }
  return (
    <pre className="block-output">
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default async function Page({ searchParams }) {
  const params = await searchParams;
  const question = typeof params?.q === "string" ? params.q : "";
  const run = question.trim() ? runAgent(question) : null;

  return (
    <main>
      <h1>Currency Agent</h1>
      <p className="subtitle">
        Every stage of the conversion is shown, so a wrong answer can be traced to the stage that
        produced it.
      </p>

      <label htmlFor="q">Ask a currency question</label>
      <form action="/" method="get">
        <input
          id="q"
          name="q"
          type="text"
          placeholder={EXAMPLE}
          defaultValue={question}
          autoComplete="off"
          autoFocus
        />
        <button type="submit">Ask</button>
      </form>
      <p className="hint">
        Try &ldquo;Convert 100 USD to JPY&rdquo; or &ldquo;Convert 100 USD to KWD&rdquo;. Supported:{" "}
        {supportedCurrencies().join(", ")}. Rates are fixed and read from data/rates.json.
      </p>

      <section className="block question-block">
        <h2 className="block-label">Question</h2>
        <p className="block-note">The currency question entered above.</p>
        <Output value={run ? run.question : null} />
      </section>

      <p className="arrow">↓</p>

      <Block
        index={1}
        label="Model Decision"
        note="What the model understood from the question, and whether it decided to call the currency lookup tool."
      >
        <Output value={run ? run.modelDecision : null} />
      </Block>

      <p className="arrow">↓</p>

      <Block
        index={2}
        label="Tool Call Arguments"
        note="The exact arguments the model sends to the currency lookup: the amount, the source currency and the target currency."
      >
        <Output value={run ? run.toolCallArguments : null} placeholder={run ? NO_TOOL_CALL : NOT_RUN} />
      </Block>

      <p className="arrow">↓</p>

      <Block
        index={3}
        label="Tool Result"
        note="What the currency lookup returns from data/rates.json: both rates, both decimal settings and the unrounded conversion."
      >
        <Output value={run ? run.toolResult : null} placeholder={run ? NO_TOOL_CALL : NOT_RUN} />
      </Block>

      <p className="arrow">↓</p>

      <Block
        index={4}
        label="Final Answer"
        note="The final formatted answer returned to the user, rounded using the target currency's decimal setting from data/rates.json."
        className="final"
      >
        {run ? (
          <>
            <pre className={`block-output${run.finalAnswer.error ? " error" : ""}`}>
              {run.finalAnswer.text}
            </pre>
            {run.finalAnswer.error ? null : (
              <pre className="block-output">
                {JSON.stringify(
                  {
                    rounded_value: run.finalAnswer.rounded_value,
                    decimals_used: run.finalAnswer.decimals_used,
                    decimals_source: run.finalAnswer.decimals_source,
                    rate_used: run.finalAnswer.rate_used,
                  },
                  null,
                  2,
                )}
              </pre>
            )}
          </>
        ) : (
          <Output value={null} />
        )}
      </Block>
    </main>
  );
}
