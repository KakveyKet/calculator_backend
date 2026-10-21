/* =========================================================
   GET SIGN WEIGHT

   RULES:

   :

   Always:
   weight = 1


   x:

   2 digits:
   12x
   55x

   weight = 1


   3 digits:

   If first two digits are the same:
   113x
   224x
   668x

   weight = 3


   Otherwise:
   123x
   168x
   527x

   weight = 6


   >:

   Inclusive range.

   Example:

   10>19

   10
   11
   12
   13
   14
   15
   16
   17
   18
   19

   weight = 10
========================================================= */

export function getSignWeight({ prefix, number, endNumber }) {
  /* =======================================================
     :
  ======================================================= */

  if (prefix === ":") {
    return 1;
  }

  /* =======================================================
     x
  ======================================================= */

  if (prefix === "x") {
    if (!number) {
      throw new Error("x requires a number.");
    }

    /* -----------------------------------------------------
       2 DIGIT

       Example:

       12x
       55x

       No special ×3 / ×6.

       Weight = 1
    ----------------------------------------------------- */

    if (number.length === 2) {
      return 1;
    }

    /* -----------------------------------------------------
       3 DIGIT
    ----------------------------------------------------- */

    if (number.length === 3) {
      /* ---------------------------------------------------
         FIRST TWO DIGITS SAME

         113
         224
         668

         Weight = 3
      --------------------------------------------------- */

      if (number[0] === number[1]) {
        return 3;
      }

      /* ---------------------------------------------------
         NORMAL 3 DIGIT

         123
         168
         527

         Weight = 6
      --------------------------------------------------- */

      return 6;
    }

    throw new Error("x requires a 2 or 3 digit number.");
  }

  /* =======================================================
     RANGE
  ======================================================= */

  if (prefix === ">") {
    if (!number || !endNumber) {
      throw new Error("Range requires start and end numbers.");
    }

    const start = Number(number);

    const end = Number(endNumber);

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      throw new Error("Invalid range.");
    }

    if (end < start) {
      throw new Error(
        "End number must be greater than or equal to start number.",
      );
    }

    /*
     * Inclusive range.
     *
     * 10 > 19
     *
     * 19 - 10 + 1
     *
     * = 10
     */

    return end - start + 1;
  }

  /* =======================================================
     UNKNOWN
  ======================================================= */

  throw new Error(`Unsupported sign: ${prefix}`);
}

/* =========================================================
   PARSE ONE CALCULATOR ENTRY
========================================================= */

export function parseCalculatorEntry(entry) {
  /* =======================================================
     ENTRY TYPE
  ======================================================= */

  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error("Calculator entry must be an object.");
  }

  /* =======================================================
     RAW
  ======================================================= */

  const raw = String(entry.raw || "").trim();

  /* =======================================================
     BASE VALUE

     Supports old "amount" field as fallback.
  ======================================================= */

  const baseValue = Number(entry.baseValue ?? entry.amount);

  /* =======================================================
     VALIDATE RAW
  ======================================================= */

  if (!raw) {
    throw new Error("Calculator expression is required.");
  }

  /* =======================================================
     VALIDATE BASE VALUE
  ======================================================= */

  if (!Number.isFinite(baseValue) || baseValue <= 0) {
    throw new Error(`Invalid base value for ${raw}.`);
  }

  /* =======================================================
     RANGE

     Examples:

     10>19
     00>09
     100>109
  ======================================================= */

  if (raw.includes(">")) {
    const parts = raw.split(">");

    /* -----------------------------------------------------
       MUST HAVE EXACTLY TWO PARTS
    ----------------------------------------------------- */

    if (parts.length !== 2) {
      throw new Error(`Invalid range expression: ${raw}`);
    }

    const number = parts[0].trim();

    const endNumber = parts[1].trim();

    /* -----------------------------------------------------
       START NUMBER

       Allow:
       2 digits
       3 digits

       Keep String to preserve:
       00
       01
       009
    ----------------------------------------------------- */

    if (!/^\d{2,3}$/.test(number)) {
      throw new Error(`Invalid start number: ${number}`);
    }

    /* -----------------------------------------------------
       END NUMBER
    ----------------------------------------------------- */

    if (!/^\d{2,3}$/.test(endNumber)) {
      throw new Error(`Invalid end number: ${endNumber}`);
    }

    /* -----------------------------------------------------
       SAME DIGIT LENGTH

       Allowed:
       10>19
       100>109

       Not allowed:
       10>100
    ----------------------------------------------------- */

    if (number.length !== endNumber.length) {
      throw new Error(
        "Start and end numbers must have the same number of digits.",
      );
    }

    /* -----------------------------------------------------
       END >= START
    ----------------------------------------------------- */

    if (Number(endNumber) < Number(number)) {
      throw new Error(
        "End number must be greater than or equal to start number.",
      );
    }

    const prefix = ">";

    const signWeight = getSignWeight({
      prefix,
      number,
      endNumber,
    });

    return {
      raw,

      number,

      prefix,

      endNumber,

      baseValue,

      signWeight,
    };
  }

  /* =======================================================
     X

     Examples:

     12x
     55x

     123x
     113x
     168x
  ======================================================= */

  if (raw.toLowerCase().endsWith("x")) {
    const number = raw.slice(0, -1).trim();

    /* -----------------------------------------------------
       ALLOW 2 OR 3 DIGITS
    ----------------------------------------------------- */

    if (!/^\d{2,3}$/.test(number)) {
      throw new Error(`Invalid number: ${number}`);
    }

    const prefix = "x";

    const signWeight = getSignWeight({
      prefix,
      number,

      endNumber: null,
    });

    return {
      raw,

      number,

      prefix,

      endNumber: null,

      baseValue,

      signWeight,
    };
  }

  /* =======================================================
     :

     Examples:

     12:
     00:
     123:
  ======================================================= */

  if (raw.endsWith(":")) {
    const number = raw.slice(0, -1).trim();

    if (!/^\d{2,3}$/.test(number)) {
      throw new Error(`Invalid number: ${number}`);
    }

    const prefix = ":";

    const signWeight = getSignWeight({
      prefix,
      number,

      endNumber: null,
    });

    return {
      raw,

      number,

      prefix,

      endNumber: null,

      baseValue,

      signWeight,
    };
  }

  /* =======================================================
     INVALID
  ======================================================= */

  throw new Error(`Invalid calculator expression: ${raw}`);
}

/* =========================================================
   PARSE ALL CALCULATOR DATA
========================================================= */

export function parseCalculatorData(calculatorData) {
  if (!Array.isArray(calculatorData) || calculatorData.length === 0) {
    throw new Error("At least one calculator entry is required.");
  }

  return calculatorData.map(parseCalculatorEntry);
}
