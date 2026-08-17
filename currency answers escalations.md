# Currency Answers — Escalations

Six wrong currency conversions that support escalated, and the single diagnostic
block that would have exposed each one.

Diagnostic categories used:

- **Model Decision**
- **Tool Call Arguments**
- **Tool Result**
- **Final Answer**

The point of the four blocks is that each failure has one block where the defect
becomes visible without guessing. Reading the blocks in order narrows a bad answer
to a stage: the model misread the request, it passed the wrong arguments, the data
it read back was wrong, or the number was correct but printed wrong.

---

## 1. "What is 100 USD in JPY?" answered as 11,000 JPY

**What went wrong**
The agent replied with a number that matched no entry in the rate table. 100 USD at
the fixed rate of 157 is 15,700 JPY. The value 11,000 came from the model answering
from its own memory of exchange rates instead of calling the lookup tool. The
phrasing ("What is …") did not look like a conversion command to the model, so it
never routed to the tool.

**Diagnostic block that would have exposed it:** Model Decision

**Why**
The Model Decision block records `call_tool`. On this question it would have read
`"call_tool": false` with an intent that was not `convert_currency`. That single
field separates "the rate table is wrong" from "the rate table was never consulted",
which is the difference between a data bug and a routing bug. No amount of checking
`data/rates.json` would have explained this answer, because the file was never read.

---

## 2. "Convert 100 CAD to USD" answered as 100.00 USD

**What went wrong**
CAD is not in the rate table. Instead of refusing, the agent quietly treated the
source currency as USD and returned the amount unchanged, so the user was told that
100 Canadian dollars equals 100 US dollars.

**Diagnostic block that would have exposed it:** Model Decision

**Why**
The Model Decision block prints `understood.from_currency` next to the original
question. Here it would have shown `"from_currency": "USD"` while the question text
directly above it said CAD. The substitution is visible as a mismatch between what
the user typed and what the model claims to have understood — before any lookup
happens. The Tool Result block would look perfectly healthy in this case, because a
USD→USD lookup is a legitimate row in the table.

---

## 3. "Convert 100 USD to INR" answered as 1.14 INR

**What went wrong**
The conversion ran in the wrong direction. The agent divided by the INR rate instead
of multiplying by it, i.e. it answered the question "how many USD is 100 INR"
(100 / 87.5 = 1.14). The correct answer is 8,750.00 INR.

**Diagnostic block that would have exposed it:** Tool Call Arguments

**Why**
The Tool Call Arguments block shows the `from` and `to` fields exactly as they are
handed to the lookup. A reversed conversion shows up there as
`{"from": "INR", "to": "USD"}` against a question that said USD to INR. That pins the
fault to argument construction rather than to the arithmetic or the rate table — the
rate used (87.5) is correct in both directions, so only the argument order reveals it.

---

## 4. "Convert 1,250 USD to AED" answered as 3.67 AED

**What went wrong**
The amount was misparsed. The thousands separator broke the number parsing, and the
agent used an amount of `1` instead of `1250`. The rate applied was correct, so the
answer looked internally consistent — it was just a conversion of the wrong amount.
The correct answer is 4,587.50 AED.

**Diagnostic block that would have exposed it:** Tool Call Arguments

**Why**
The Tool Call Arguments block prints the parsed `amount` as a number:
`{"amount": 1, "from": "USD", "to": "AED"}`. Comparing that `1` with the `1,250` in
the question makes the truncation obvious in one glance. Every downstream block would
have been correct for the arguments it was given — the Tool Result would show the
right AED rate, and the Final Answer would show the right number of decimals — which
is precisely why the failure has to be caught at the argument stage.

---

## 5. "Convert 200 USD to AED" answered as 730.00 AED

**What went wrong**
The rate applied was 3.65, but `data/rates.json` defines AED at 3.67. A second,
stale copy of the rate had been left inside the answering code, so the tool result no
longer agreed with the committed rate file. The correct answer is 734.00 AED.

**Diagnostic block that would have exposed it:** Tool Result

**Why**
The Tool Result block prints `source` and the actual `rate_per_usd` that was read
back. Diffing `"rate_per_usd": 3.65` against the `3.67` in `data/rates.json` proves
the data path is not reading the committed file. The arguments were right and the
formatting was right, so this failure is only visible where the retrieved data is
displayed — a block that only shows the final sentence gives the reviewer no way to
tell a wrong rate from wrong arithmetic.

---

## 6. "Convert 100 USD to KWD" answered as 31.00 KWD

**What went wrong**
The computed value (31) was correct, but it was printed with two decimal places
instead of the three that KWD requires. The Kuwaiti dinar is a three-decimal
currency, so `31.00 KWD` is a malformed amount. The same defect printed JPY as
`15,700.00 JPY` when JPY takes zero decimals. The formatter had a hard-coded default
of two decimals rather than reading `decimals` from the target currency's entry.

**Diagnostic block that would have exposed it:** Final Answer

**Why**
The Final Answer block reports `decimals_used` alongside `decimals_source`. It would
have shown `"decimals_used": 2` while the Tool Result block immediately above it
showed `"decimals": 3` for KWD. Two adjacent blocks disagreeing about the same
setting localises the bug to the formatting step and rules out the rate table, the
arguments, and the arithmetic — all three of which were correct here.
