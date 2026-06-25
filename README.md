# WAAM Stainless Steel Bolted Connection Calculator

Calculation tools for WAAM austenitic and duplex stainless steel single-bolt,
double-shear, bearing-type connections.

## Online edition

Use the calculator directly in a browser:

**https://wenkang-zuo.github.io/waam-bolted-connection-calculator/**

The online edition requires no installation and supports rapid single-case
prediction. All calculations run locally in the browser, and no input data are
uploaded.

## Local edition

The local edition additionally supports Excel/CSV batch input and Excel result
export.

- [Download the local edition ZIP](downloads/WAAM-Bolted-Connection-Calculator-local.zip)

Extract the ZIP and read its `README.md` file. Python 3.10 or later is required;
no third-party Python packages are needed.

## Implemented methods

- ANSI/AISC 360-22
- ANSI/AISC 370-21
- ASCE/SEI 8-22
- EN 1993-1-8:2024
- EN 1993-1-4:2025
- Literature method
- Proposed-gv
- Proposed-av

The reported outputs are the nominal ultimate resistance and governing plate
failure mode: net-section rupture, shear-out failure, or bearing failure.

## Scope

The tools evaluate the plate-related resistance of the inner WAAM stainless
steel plate. Bolt failure, frictional slip, and failure of the outer cover
plates are outside their scope and must be checked separately.
