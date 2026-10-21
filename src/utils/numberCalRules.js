/*
|--------------------------------------------------------------------------
| PARSE CALCULATOR EXPRESSION
|--------------------------------------------------------------------------
*/

export function parseNumberExpression(rawValue) {
  const raw = String(rawValue || "").trim();

  if (!raw) {
    throw new Error("Calculator expression is required.");
  }

  /* =======================================================
     RANGE >
  ======================================================= */

  if (raw.includes(">")) {
    const parts = raw.split(">");

    if (parts.length !== 2) {
      throw new Error(`Invalid range expression: ${raw}`);
    }

    const number = parts[0].trim();

    const endNumber = parts[1].trim();

    if (!/^\d{2,3}$/.test(number)) {
      throw new Error(`Invalid start number: ${number}`);
    }

    if (!/^\d{2,3}$/.test(endNumber)) {
      throw new Error(`Invalid end number: ${endNumber}`);
    }

    if (number.length !== endNumber.length) {
      throw new Error(
        "Start and end numbers must have the same number of digits.",
      );
    }

    const start = Number(number);

    const end = Number(endNumber);

    if (end < start) {
      throw new Error(
        "End number must be greater than or equal to start number.",
      );
    }

    const generatedNumbers = [];

    for (let current = start; current <= end; current++) {
      generatedNumbers.push(String(current).padStart(number.length, "0"));
    }

    /*
     * 10>15
     *
     * 10
     * 11
     * 12
     * 13
     * 14
     * 15
     *
     * multiplier = 6
     */

    return {
      raw,
      number,
      prefix: ">",
      endNumber,

      operationMultiplier: generatedNumbers.length,

      generatedNumbers,
    };
  }

  /* =======================================================
     X
  ======================================================= */

  if (raw.toLowerCase().endsWith("x")) {
    const number = raw.slice(0, -1).trim();

    if (!/^\d{2,3}$/.test(number)) {
      throw new Error(`Invalid number: ${number}`);
    }

    const firstDigit = number[0];

    const secondDigit = number[1];

    /*
     * Examples:
     *
     * 668x
     *
     * first two digits are same
     *
     * => multiplier = 3
     *
     *
     * 768x
     *
     * first two digits different
     *
     * => multiplier = 6
     */

    const operationMultiplier = firstDigit === secondDigit ? 3 : 6;

    return {
      raw,
      number,
      prefix: "x",
      endNumber: null,

      operationMultiplier,

      generatedNumbers: [number],
    };
  }

  /* =======================================================
     :
  ======================================================= */

  if (raw.endsWith(":")) {
    const number = raw.slice(0, -1).trim();

    if (!/^\d{2,3}$/.test(number)) {
      throw new Error(`Invalid number: ${number}`);
    }

    /*
     * :
     *
     * Always multiplier = 1
     */

    return {
      raw,
      number,
      prefix: ":",
      endNumber: null,

      operationMultiplier: 1,

      generatedNumbers: [number],
    };
  }

  throw new Error(`Invalid calculator expression: ${raw}`);
}
