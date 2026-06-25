(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.WAAMCalculator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const methodLabels = {
    AISC360: "ANSI/AISC 360-22",
    AISC370: "ANSI/AISC 370-21",
    ASCE8: "ASCE/SEI 8-22",
    "EC3-8": "EN 1993-1-8:2024",
    "EC3-4": "EN 1993-1-4:2025",
    Literature: "Literature",
    "pro,gv": "Proposed-gv",
    "pro,av": "Proposed-av",
  };

  class ValidationError extends Error {
    constructor(errors, warnings = []) {
      super(errors.join("; "));
      this.name = "ValidationError";
      this.errors = errors;
      this.warnings = warnings;
    }
  }

  function number(data, ...keys) {
    for (const key of keys) {
      if (!(key in data)) continue;
      const value = data[key];
      if (value === null || String(value).trim() === "") continue;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  function normalizeInputs(data) {
    const errors = [];
    const warnings = [];
    const material = String(data.Material ?? data.material ?? "").trim().toUpperCase();
    if (!["ASS", "DSS"].includes(material)) errors.push("Material must be ASS or DSS.");

    const values = {
      fy: number(data, "fy_MPa_theta", "fy_MPa", "fy", "Fy"),
      fu: number(data, "fu_MPa_theta", "fu_MPa2", "fu_MPa", "fu", "Fu"),
      fub: number(data, "fub_MPa", "fub", "Fub"),
      t: number(data, "t_mm", "t"),
      db: number(data, "db_mm", "db"),
      dh: number(data, "dh_mm", "dh"),
      b: number(data, "b_mm", "b"),
      e1: number(data, "e1_mm", "e1"),
      e2: number(data, "e2_mm", "e2"),
    };
    const labels = { fy: "fy (θ direction)", fu: "fu (θ direction)", fub: "fub", t: "t", db: "db", dh: "dh", e1: "e1" };
    for (const [key, label] of Object.entries(labels)) {
      if (values[key] === null) errors.push(`${label} must be a valid number.`);
      else if (values[key] <= 0) errors.push(`${label} must be greater than zero.`);
    }

    let { b, e2 } = values;
    if (b === null && e2 === null) errors.push("Enter at least one of b and e2.");
    else if (b !== null && b <= 0) errors.push("b must be greater than zero.");
    else if (e2 !== null && e2 <= 0) errors.push("e2 must be greater than zero.");
    else if (b === null) b = 2 * e2;
    else if (e2 === null) e2 = b / 2;
    else if (Math.abs(b - 2 * e2) > Math.max(0.01, 1e-6 * b)) errors.push("b and e2 are inconsistent. The geometry must satisfy b = 2e2.");

    if (errors.length) throw new ValidationError(errors, warnings);
    const { fy, fu, fub, t, db, dh, e1 } = values;
    if (fy > fu) errors.push("fy (θ direction) must not exceed fu (θ direction).");
    if (!Number.isInteger(db)) errors.push("db must be a positive integer.");
    else if (db > 30) errors.push("db must not exceed 30 mm for the implemented hole-clearance rules.");
    if (dh <= db) errors.push("dh must be greater than db.");
    else if (Number.isInteger(db) && db <= 30) {
      const clearance = dh - db;
      let clearanceMin;
      let clearanceMax;
      if (db < 12) [clearanceMin, clearanceMax] = [0.5, 1.5];
      else if (db <= 23) [clearanceMin, clearanceMax] = [1.5, 2.5];
      else [clearanceMin, clearanceMax] = [2.5, 3.5];
      if (clearance < clearanceMin || clearance > clearanceMax) errors.push(`For db = ${db} mm, dh - db must be between ${clearanceMin} and ${clearanceMax} mm.`);
    }
    if (b <= dh) errors.push("Plate width b must be greater than hole diameter dh.");
    if (e1 <= dh / 2) errors.push("e1 must be greater than dh/2.");
    if (e2 <= dh / 2) errors.push("e2 must be greater than dh/2.");
    if (errors.length) throw new ValidationError(errors, warnings);

    const details = [];
    if (e1 / dh < 1.2) details.push(`e1/dh = ${(e1 / dh).toFixed(3)} < 1.200`);
    if (e2 / dh < 1.2) details.push(`e2/dh = ${(e2 / dh).toFixed(3)} < 1.200`);
    if (t > 5) details.push(`t = ${t} mm > 5 mm`);
    if (details.length) warnings.push("One or more input parameters fall outside the recommended applicability range of the proposed methods. The predicted resistance should be treated as an extrapolation and used with caution. Affected parameter(s): " + details.join("; ") + ".");

    return { inputs: { Material: material, fy_MPa_theta: fy, fu_MPa_theta: fu, fub_MPa: fub, t_mm: t, db_mm: db, dh_mm: dh, b_mm: b, e1_mm: e1, e2_mm: e2 }, warnings };
  }

  function governing(candidates) {
    return candidates.reduce((best, current) => (current[1] < best[1] ? current : best));
  }
  function round6(value) { return Number(value.toFixed(6)); }

  function calculate(data) {
    const normalized = normalizeInputs(data);
    const source = normalized.inputs;
    const x = { material: source.Material, fy: source.fy_MPa_theta, fu: source.fu_MPa_theta, fub: source.fub_MPa, t: source.t_mm, db: source.db_mm, dh: source.dh_mm, b: source.b_mm, e1: source.e1_mm, e2: source.e2_mm };
    const scale = (x.t * x.fu) / 1000;
    const nsrOther = (x.b - x.dh) * scale;
    const nsrAsce = (0.9 + (0.1 * x.db) / x.b) * (x.b - x.dh) * scale;
    const km = x.fy <= 460 ? 1.0 : 0.9;
    const k1 = x.e2 / x.dh > 1.5 ? 1.0 : 0.8;

    const definitions = {
      AISC360: [["NSR", nsrOther], ["SOF", Math.max(0, 0.75 * 2 * (x.e1 - x.dh / 2) * scale)], ["BF", 3 * x.db * scale]],
      AISC370: [["NSR", nsrOther], ["SOF", ((1.25 * x.db) / (3 * x.dh)) * 2 * x.e1 * scale], ["BF", (x.e2 / x.dh > 1.5 ? 2.5 : 2.0) * x.db * scale]],
      ASCE8: [["NSR", nsrAsce], ["SOF", Math.max(0, 0.6 * 2 * (x.e1 - x.dh / 2) * scale)], ["BF", 2.8 * x.db * scale]],
      "EC3-8": [["NSR", nsrOther], ["SOF", km * (x.e1 / x.dh) * x.db * scale], ["BF", 3 * km * Math.min(x.fub / x.fu, 1) * x.db * scale]],
      "EC3-4": [["NSR", nsrOther], ["SOF", ((5 * k1 * x.db) / (12 * x.dh)) * 2 * x.e1 * scale], ["BF", 2.5 * k1 * x.db * scale]],
      Literature: [["NSR", nsrOther], ["SOF", Math.max(0, 1.2 * (3 * x.db / x.e1) ** 0.1 * (x.e1 - x.dh / 4) * scale)], ["BF", 3.5 * x.db * scale]],
      "pro,gv": [["NSR", nsrOther], ["SOF", 1.1 * (x.e1 / x.dh) * x.db * scale], ["BF", 3 * 1.1 * Math.min(x.fub / x.fu, 1) * x.db * scale]],
      "pro,av": [["NSR", nsrOther], ["SOF", Math.max(0, 1.1 * (3 * x.db / x.e1) ** 0.2 * (x.e1 - x.dh / 4) * scale)], ["BF", 3.5 * x.db * scale]],
    };
    const outputNames = {
      AISC360: ["PAISC360_u_kN", "Gov_AISC360"], AISC370: ["PAISC370_u_kN", "Gov_AISC370"], ASCE8: ["PASCE8_u_kN", "Gov_ASCE8"], "EC3-8": ["PEC3-8_u_kN", "Gov_EC3-8"], "EC3-4": ["PEC3-4_u_kN", "Gov_EC3-4"], Literature: ["PLiterature_u_kN", "Gov_Literature"], "pro,gv": ["Ppro,gv_u_kN", "Gov_pro,gv"], "pro,av": ["Ppro,av_u_kN", "Gov_pro,av"],
    };
    const results = {};
    const methods = [];
    for (const [key, candidates] of Object.entries(definitions)) {
      const [mode, resistance] = governing(candidates);
      const [resistanceName, modeName] = outputNames[key];
      results[resistanceName] = round6(resistance);
      results[modeName] = mode;
      methods.push({ key, method: methodLabels[key], resistance: round6(resistance), mode, candidates: Object.fromEntries(candidates.map(([name, value]) => [name, round6(value)])) });
    }
    return { inputs: source, results, methods, warnings: normalized.warnings, parameters: { "km_EC3-8": km, "k1_EC3-4": k1, "alpha_b_EC3-8": Math.min(x.e1 / x.dh, (3 * x.fub) / x.fu, 3), alpha_b_pro_gv: Math.min(x.e1 / x.dh, (3 * x.fub) / x.fu, 3) } };
  }

  return { calculate, normalizeInputs, ValidationError, methodLabels };
});
