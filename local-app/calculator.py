"""Calculation core for WAAM stainless-steel double-shear bolted connections."""

from __future__ import annotations

from dataclasses import dataclass
from math import isfinite
from typing import Any


INPUT_COLUMNS = [
    "Material",
    "fy_MPa_theta",
    "fu_MPa_theta",
    "fub_MPa",
    "t_mm",
    "db_mm",
    "dh_mm",
    "b_mm",
    "e1_mm",
    "e2_mm",
]

OUTPUT_COLUMNS = [
    "PAISC360_u_kN",
    "Gov_AISC360",
    "PAISC370_u_kN",
    "Gov_AISC370",
    "PASCE8_u_kN",
    "Gov_ASCE8",
    "PEC3-8_u_kN",
    "Gov_EC3-8",
    "PEC3-4_u_kN",
    "Gov_EC3-4",
    "PLiterature_u_kN",
    "Gov_Literature",
    "Ppro,gv_u_kN",
    "Gov_pro,gv",
    "Ppro,av_u_kN",
    "Gov_pro,av",
]

METHOD_LABELS = {
    "AISC360": "ANSI/AISC 360-22",
    "AISC370": "ANSI/AISC 370-21",
    "ASCE8": "ASCE/SEI 8-22",
    "EC3-8": "EN 1993-1-8:2024",
    "EC3-4": "EN 1993-1-4:2025",
    "Literature": "Literature",
    "pro,gv": "Proposed-gv",
    "pro,av": "Proposed-av",
}


class ValidationError(ValueError):
    def __init__(self, errors: list[str], warnings: list[str] | None = None):
        super().__init__("; ".join(errors))
        self.errors = errors
        self.warnings = warnings or []


@dataclass(frozen=True)
class Inputs:
    material: str
    fy: float
    fu: float
    fub: float
    t: float
    db: float
    dh: float
    b: float
    e1: float
    e2: float

    def as_dict(self) -> dict[str, Any]:
        return {
            "Material": self.material,
            "fy_MPa_theta": self.fy,
            "fu_MPa_theta": self.fu,
            "fub_MPa": self.fub,
            "t_mm": self.t,
            "db_mm": self.db,
            "dh_mm": self.dh,
            "b_mm": self.b,
            "e1_mm": self.e1,
            "e2_mm": self.e2,
        }


def _number(data: dict[str, Any], *keys: str) -> float | None:
    for key in keys:
        if key not in data:
            continue
        value = data[key]
        if value is None or str(value).strip() == "":
            continue
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        return number if isfinite(number) else None
    return None


def normalize_inputs(data: dict[str, Any]) -> tuple[Inputs, list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    material = str(data.get("Material", data.get("material", ""))).strip().upper()
    if material not in {"ASS", "DSS"}:
        errors.append("Material must be ASS or DSS.")

    fields = {
        "fy": _number(data, "fy_MPa_theta", "fy_MPa", "fy", "Fy"),
        "fu": _number(data, "fu_MPa_theta", "fu_MPa2", "fu_MPa", "fu", "Fu"),
        "fub": _number(data, "fub_MPa", "fub", "Fub"),
        "t": _number(data, "t_mm", "t"),
        "db": _number(data, "db_mm", "db"),
        "dh": _number(data, "dh_mm", "dh"),
        "b": _number(data, "b_mm", "b"),
        "e1": _number(data, "e1_mm", "e1"),
        "e2": _number(data, "e2_mm", "e2"),
    }

    labels = {
        "fy": "fy (θ direction)",
        "fu": "fu (θ direction)",
        "fub": "fub",
        "t": "t",
        "db": "db",
        "dh": "dh",
        "e1": "e1",
    }
    for key, label in labels.items():
        if fields[key] is None:
            errors.append(f"{label} must be a valid number.")
        elif fields[key] <= 0:
            errors.append(f"{label} must be greater than zero.")

    b = fields["b"]
    e2 = fields["e2"]
    if b is None and e2 is None:
        errors.append("Enter at least one of b and e2.")
    elif b is not None and b <= 0:
        errors.append("b must be greater than zero.")
    elif e2 is not None and e2 <= 0:
        errors.append("e2 must be greater than zero.")
    elif b is None:
        b = 2.0 * e2
    elif e2 is None:
        e2 = b / 2.0
    elif abs(b - 2.0 * e2) > max(0.01, 1e-6 * b):
        errors.append("b and e2 are inconsistent. The geometry must satisfy b = 2e2.")

    if errors:
        raise ValidationError(errors, warnings)

    assert b is not None and e2 is not None
    assert fields["fy"] is not None
    assert fields["fu"] is not None
    assert fields["fub"] is not None
    assert fields["t"] is not None
    assert fields["db"] is not None
    assert fields["dh"] is not None
    assert fields["e1"] is not None
    fy = float(fields["fy"])
    fu = float(fields["fu"])
    fub = float(fields["fub"])
    t = float(fields["t"])
    db = float(fields["db"])
    dh = float(fields["dh"])
    e1 = float(fields["e1"])

    if fy > fu:
        errors.append("fy (θ direction) must not exceed fu (θ direction).")
    if not db.is_integer():
        errors.append("db must be a positive integer.")
    elif db > 30:
        errors.append("db must not exceed 30 mm for the implemented hole-clearance rules.")
    if dh <= db:
        errors.append("dh must be greater than db.")
    elif db.is_integer() and db <= 30:
        clearance = dh - db
        if db < 12:
            clearance_min, clearance_max = 0.5, 1.5
        elif db <= 23:
            clearance_min, clearance_max = 1.5, 2.5
        else:
            clearance_min, clearance_max = 2.5, 3.5
        if not (clearance_min <= clearance <= clearance_max):
            errors.append(
                f"For db = {db:g} mm, dh - db must be between "
                f"{clearance_min:g} and {clearance_max:g} mm."
            )
    if b <= dh:
        errors.append("Plate width b must be greater than hole diameter dh.")
    if e1 <= dh / 2.0:
        errors.append("e1 must be greater than dh/2.")
    if e2 <= dh / 2.0:
        errors.append("e2 must be greater than dh/2.")

    if errors:
        raise ValidationError(errors, warnings)

    applicability_details: list[str] = []
    if e1 / dh < 1.2:
        applicability_details.append(f"e1/dh = {e1 / dh:.3f} < 1.200")
    if e2 / dh < 1.2:
        applicability_details.append(f"e2/dh = {e2 / dh:.3f} < 1.200")
    if t > 5.0:
        applicability_details.append(f"t = {t:g} mm > 5 mm")
    if applicability_details:
        warnings.append(
            "One or more input parameters fall outside the recommended "
            "applicability range of the proposed methods. The predicted "
            "resistance should be treated as an extrapolation and used with caution. "
            + "Affected parameter(s): "
            + "; ".join(applicability_details)
            + "."
        )

    return Inputs(material, fy, fu, fub, t, db, dh, b, e1, e2), warnings


def _governing(candidates: list[tuple[str, float]]) -> tuple[float, str]:
    mode, value = min(candidates, key=lambda item: item[1])
    return value, mode


def calculate(data: dict[str, Any]) -> dict[str, Any]:
    x, warnings = normalize_inputs(data)
    scale = x.t * x.fu / 1000.0

    nsr_other = (x.b - x.dh) * scale
    nsr_asce = (0.9 + 0.1 * x.db / x.b) * (x.b - x.dh) * scale

    aisc360_sof = max(0.0, 0.75 * 2.0 * (x.e1 - x.dh / 2.0) * scale)
    aisc360_bf = 3.0 * x.db * scale

    aisc370_sof = (1.25 * x.db / (3.0 * x.dh)) * 2.0 * x.e1 * scale
    edge_factor = 2.5 if x.e2 / x.dh > 1.5 else 2.0
    aisc370_bf = edge_factor * x.db * scale

    asce8_sof = max(0.0, 0.6 * 2.0 * (x.e1 - x.dh / 2.0) * scale)
    asce8_bf = 2.8 * x.db * scale

    km = 1.0 if x.fy <= 460.0 else 0.9
    ec38_sof = km * (x.e1 / x.dh) * x.db * scale
    ec38_bf = 3.0 * km * min(x.fub / x.fu, 1.0) * x.db * scale

    k1 = 1.0 if x.e2 / x.dh > 1.5 else 0.8
    ec34_sof = (5.0 * k1 * x.db / (12.0 * x.dh)) * 2.0 * x.e1 * scale
    ec34_bf = 2.5 * k1 * x.db * scale

    literature_sof = max(
        0.0,
        1.2 * (3.0 * x.db / x.e1) ** 0.1 * (x.e1 - x.dh / 4.0) * scale,
    )
    literature_bf = 3.5 * x.db * scale

    proposed_gv_sof = 1.1 * (x.e1 / x.dh) * x.db * scale
    proposed_gv_bf = 3.0 * 1.1 * min(x.fub / x.fu, 1.0) * x.db * scale

    proposed_av_sof = max(
        0.0,
        1.1 * (3.0 * x.db / x.e1) ** 0.2 * (x.e1 - x.dh / 4.0) * scale,
    )
    proposed_av_bf = 3.5 * x.db * scale

    definitions = {
        "AISC360": [("NSR", nsr_other), ("SOF", aisc360_sof), ("BF", aisc360_bf)],
        "AISC370": [("NSR", nsr_other), ("SOF", aisc370_sof), ("BF", aisc370_bf)],
        "ASCE8": [("NSR", nsr_asce), ("SOF", asce8_sof), ("BF", asce8_bf)],
        "EC3-8": [("NSR", nsr_other), ("SOF", ec38_sof), ("BF", ec38_bf)],
        "EC3-4": [("NSR", nsr_other), ("SOF", ec34_sof), ("BF", ec34_bf)],
        "Literature": [("NSR", nsr_other), ("SOF", literature_sof), ("BF", literature_bf)],
        "pro,gv": [("NSR", nsr_other), ("SOF", proposed_gv_sof), ("BF", proposed_gv_bf)],
        "pro,av": [("NSR", nsr_other), ("SOF", proposed_av_sof), ("BF", proposed_av_bf)],
    }

    results: dict[str, Any] = {}
    detail: list[dict[str, Any]] = []
    output_names = {
        "AISC360": ("PAISC360_u_kN", "Gov_AISC360"),
        "AISC370": ("PAISC370_u_kN", "Gov_AISC370"),
        "ASCE8": ("PASCE8_u_kN", "Gov_ASCE8"),
        "EC3-8": ("PEC3-8_u_kN", "Gov_EC3-8"),
        "EC3-4": ("PEC3-4_u_kN", "Gov_EC3-4"),
        "Literature": ("PLiterature_u_kN", "Gov_Literature"),
        "pro,gv": ("Ppro,gv_u_kN", "Gov_pro,gv"),
        "pro,av": ("Ppro,av_u_kN", "Gov_pro,av"),
    }
    for key, candidates in definitions.items():
        resistance, mode = _governing(candidates)
        resistance_name, mode_name = output_names[key]
        results[resistance_name] = round(resistance, 6)
        results[mode_name] = mode
        detail.append(
            {
                "key": key,
                "method": METHOD_LABELS[key],
                "resistance": round(resistance, 6),
                "mode": mode,
                "candidates": {
                    candidate_mode: round(candidate_value, 6)
                    for candidate_mode, candidate_value in candidates
                },
            }
        )

    return {
        "inputs": x.as_dict(),
        "results": results,
        "methods": detail,
        "warnings": warnings,
        "parameters": {
            "km_EC3-8": km,
            "k1_EC3-4": k1,
            "alpha_b_EC3-8": min(x.e1 / x.dh, 3.0 * x.fub / x.fu, 3.0),
            "alpha_b_pro_gv": min(x.e1 / x.dh, 3.0 * x.fub / x.fu, 3.0),
        },
    }
