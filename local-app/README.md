# WAAM Stainless Steel Bolted Connection Calculator — Local Edition

The local edition evaluates WAAM austenitic and duplex stainless steel
single-bolt, double-shear, bearing-type connections. It compares nominal
resistance and governing plate failure mode predictions from ANSI/AISC 360-22,
ANSI/AISC 370-21, ASCE/SEI 8-22, EN 1993-1-8:2024, EN 1993-1-4:2025, a
literature method, Proposed-gv, and Proposed-av.

## Requirements

- Python 3.10 or later
- A modern web browser

No third-party Python packages are required. The application runs entirely on
the local computer and does not upload calculation data.

## Start on Windows

1. Download the repository ZIP from GitHub and extract it.
2. Open the `local-app` folder.
3. Double-click `start.bat`.
4. The calculator opens automatically at <http://127.0.0.1:8765/>.

Alternatively, run:

```powershell
.\start.ps1
```

## Start on macOS or Linux

From the `local-app` folder, run:

```bash
python3 server.py --open
```

## Functions

- Single-case prediction
- Excel or CSV batch input
- Excel result export
- Automatic calculation of `b = 2e2`
- Mandatory geometry and material validation
- Proposed-method applicability warnings

The Batch Prediction page provides a downloadable Excel input template. The
output workbook contains the original inputs, resistance and governing-mode
predictions for all eight methods, warnings, and row-specific errors.

## Scope

The calculator covers the plate-related resistance of the inner WAAM stainless
steel plate in non-preloaded, single-bolt, double-shear, bearing-type
connections. Bolt failure, frictional slip, and failure of the outer cover
plates must be checked separately.
