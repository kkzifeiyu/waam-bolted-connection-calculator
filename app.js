const form = document.getElementById("calculator-form");
const resultsBody = document.getElementById("results-body");
const resultSummary = document.getElementById("result-summary");
const parametersStrip = document.getElementById("parameters-strip");
const messageBox = document.getElementById("message-box");
const bInput = document.getElementById("b-input");
const e2Input = document.getElementById("e2-input");
const resetButton = document.getElementById("reset-button");

let calculationTimer;
const sample = {
  Material: "ASS",
  fy_MPa_theta: 380,
  fu_MPa_theta: 513.2,
  fub_MPa: 800,
  t_mm: 3.43,
  db_mm: 18,
  dh_mm: 20,
  b_mm: 140,
  e1_mm: 30,
  e2_mm: 70,
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setMessage(messages = [], type = "error") {
  if (!messages.length) {
    messageBox.className = "message-box";
    messageBox.textContent = "";
    return;
  }
  messageBox.className = `message-box show ${type}`;
  messageBox.innerHTML = messages.map((message) => `<div>${escapeHtml(message)}</div>`).join("");
}

function formData() {
  return Object.fromEntries(new FormData(form).entries());
}

function renderResults(payload) {
  const values = payload.methods.map((method) => method.resistance);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  resultSummary.classList.remove("skeleton");
  resultSummary.innerHTML = `
    <span>Range across eight methods</span>
    <strong>${minimum.toFixed(2)} – ${maximum.toFixed(2)} kN</strong>
  `;
  resultsBody.innerHTML = payload.methods
    .map((method) => {
      const width = maximum ? (method.resistance / maximum) * 100 : 0;
      const family = method.key.startsWith("pro,")
        ? "Proposed method"
        : method.key === "Literature"
          ? "Literature"
          : "Design standard";
      return `
        <tr>
          <td><span class="method-name">${escapeHtml(method.method)}<small>${family}</small></span></td>
          <td><span class="resistance">${method.resistance.toFixed(2)} <small>kN</small></span></td>
          <td><span class="mode-badge ${method.mode.toLowerCase()}">${method.mode}</span></td>
          <td><div class="bar-track"><div class="bar-fill" style="width:${width.toFixed(1)}%"></div></div></td>
        </tr>
      `;
    })
    .join("");

  const parameters = payload.parameters;
  parametersStrip.innerHTML = `
    <span>k<sub>m, EN 1993-1-8</sub> = ${parameters["km_EC3-8"].toFixed(2)}</span>
    <span>k<sub>1, EN 1993-1-4</sub> = ${parameters["k1_EC3-4"].toFixed(2)}</span>
    <span>α<sub>b, EN 1993-1-8</sub> = ${parameters["alpha_b_EC3-8"].toFixed(3)}</span>
    <span>α<sub>b, Proposed-gv</sub> = ${parameters.alpha_b_pro_gv.toFixed(3)}</span>
  `;
}

function calculate() {
  try {
    const payload = WAAMCalculator.calculate(formData());
    renderResults(payload);
    setMessage(payload.warnings, "warning");
  } catch (error) {
    if (error instanceof WAAMCalculator.ValidationError) {
      setMessage(error.errors);
      return;
    }
    setMessage([`Calculation failed: ${error.message}`]);
  }
}

function scheduleCalculation() {
  clearTimeout(calculationTimer);
  calculationTimer = setTimeout(calculate, 100);
}

function formatLinked(value) {
  return Number.isFinite(value) ? Number(value.toFixed(6)).toString() : "";
}

form.addEventListener("input", (event) => {
  if (event.target === e2Input && e2Input.value !== "") {
    bInput.value = formatLinked(Number(e2Input.value) * 2);
  }
  if (event.target === bInput && bInput.value !== "") {
    e2Input.value = formatLinked(Number(bInput.value) / 2);
  }
  scheduleCalculation();
});

resetButton.addEventListener("click", () => {
  Object.entries(sample).forEach(([name, value]) => {
    form.elements[name].value = value;
  });
  calculate();
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`${tab.dataset.tab}-panel`).classList.add("active");
  });
});

calculate();
