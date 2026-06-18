const fileInput = document.querySelector("#csv-file");
const dropzone = document.querySelector("#dropzone");
const sampleButton = document.querySelector("#sample-data");
const clearButton = document.querySelector("#clear-data");
const exportButton = document.querySelector("#export-analysis");
const printButton = document.querySelector("#print-dashboard");
const emptyState = document.querySelector("#empty-state");
const dashboard = document.querySelector("#dashboard");
const schemaGrid = document.querySelector("#schema-grid");
const chartGrid = document.querySelector("#chart-grid");
const statsStrip = document.querySelector("#stats-strip");
const fileLabel = document.querySelector("#file-label");
const dashboardTitle = document.querySelector("#dashboard-title");
const qualityNote = document.querySelector("#quality-note");
const chartCount = document.querySelector("#chart-count");
const insightGrid = document.querySelector("#insight-grid");
const correlationMatrix = document.querySelector("#correlation-matrix");
const typeBreakdown = document.querySelector("#type-breakdown");
const columnSearch = document.querySelector("#column-search");
const typeFilter = document.querySelector("#type-filter");
const chartSearch = document.querySelector("#chart-search");
const chartFamily = document.querySelector("#chart-family");
const chartLimit = document.querySelector("#chart-limit");
const chartLimitValue = document.querySelector("#chart-limit-value");
const dataPreview = document.querySelector("#data-preview");
const previewCount = document.querySelector("#preview-count");

const MAX_CHARTS = 40;
let charts = [];
let chartCounter = 0;
let currentModel = null;
let allChartCandidates = [];

const sampleCsv = `Date,Region,Product,Sales,Units,Profit,Discount,Customer Segment,Channel
2026-01-01,North,Analytics Pro,18200,91,4310,0.08,Enterprise,Partner
2026-01-02,South,Insights Lite,9600,120,2110,0.12,SMB,Direct
2026-01-03,East,Analytics Pro,15420,78,3890,0.05,Enterprise,Direct
2026-01-04,West,Data Studio,12100,61,2740,0.07,Mid-Market,Partner
2026-01-05,North,Insights Lite,8700,103,1880,0.15,SMB,Marketplace
2026-01-06,South,Data Studio,14100,70,3190,0.04,Mid-Market,Direct
2026-01-07,East,Analytics Pro,19600,98,5100,0.03,Enterprise,Partner
2026-01-08,West,Insights Lite,7900,99,1640,0.18,SMB,Marketplace
2026-01-09,North,Data Studio,13300,66,2900,0.06,Mid-Market,Direct
2026-01-10,South,Analytics Pro,17100,86,4200,0.09,Enterprise,Partner
2026-01-11,East,Insights Lite,9100,114,2020,0.11,SMB,Direct
2026-01-12,West,Data Studio,15700,79,3610,0.05,Mid-Market,Marketplace`;

fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) parseFile(file);
});

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("dragging");
});

dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragging"));

dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzone.classList.remove("dragging");
  const [file] = event.dataTransfer.files;
  if (file) parseFile(file);
});

sampleButton.addEventListener("click", () => parseCsv(sampleCsv, "sample-sales.csv"));

clearButton.addEventListener("click", () => {
  fileInput.value = "";
  currentModel = null;
  allChartCandidates = [];
  destroyCharts();
  emptyState.classList.remove("hidden");
  dashboard.classList.add("hidden");
  statsStrip.innerHTML = "";
  insightGrid.innerHTML = "";
  correlationMatrix.innerHTML = "";
  typeBreakdown.innerHTML = "";
  dataPreview.innerHTML = "";
  fileLabel.textContent = "No file loaded";
  dashboardTitle.textContent = "CSV Auto Analysis";
  exportButton.disabled = true;
  printButton.disabled = true;
});

exportButton.addEventListener("click", exportAnalysis);
printButton.addEventListener("click", () => window.print());

document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => activateView(button.dataset.view));
});

columnSearch.addEventListener("input", renderSchema);
typeFilter.addEventListener("change", renderSchema);
chartSearch.addEventListener("input", renderCharts);
chartFamily.addEventListener("change", renderCharts);
chartLimit.addEventListener("input", () => {
  chartLimitValue.textContent = chartLimit.value;
  renderCharts();
});

function parseFile(file) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    complete: (result) => parseResult(result, file.name),
    error: (error) => alert(`Could not parse CSV: ${error.message}`),
  });
}

function parseCsv(csv, name) {
  Papa.parse(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    complete: (result) => parseResult(result, name),
  });
}

function parseResult(result, name) {
  const headers = result.meta.fields.filter(Boolean);
  const rows = result.data.filter((row) =>
    headers.some((header) => normalizeCell(row[header]) !== "")
  );

  if (!headers.length || !rows.length) {
    alert("This CSV needs headers and at least one data row.");
    return;
  }

  const profiles = headers.map((header) => profileColumn(header, rows));
  const firstRow = rows[0];
  renderDashboard({ name, headers, rows, profiles, firstRow });
}

function profileColumn(header, rows) {
  const rawValues = rows.map((row) => normalizeCell(row[header]));
  const total = rawValues.length;
  const nonEmpty = rawValues.filter((value) => value !== "");
  const missing = total - nonEmpty.length;
  const unique = new Set(nonEmpty.map((value) => value.toLowerCase()));
  const numbers = nonEmpty.map(parseNumber).filter((value) => Number.isFinite(value));
  const dates = nonEmpty.map(parseDate).filter((value) => value instanceof Date);
  const booleans = nonEmpty.filter((value) => /^(true|false|yes|no|0|1)$/i.test(value));
  const emails = nonEmpty.filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
  const urls = nonEmpty.filter((value) => /^https?:\/\//i.test(value));

  const numberConfidence = nonEmpty.length ? numbers.length / nonEmpty.length : 0;
  const dateConfidence = nonEmpty.length ? dates.length / nonEmpty.length : 0;
  const booleanConfidence = nonEmpty.length ? booleans.length / nonEmpty.length : 0;
  const uniqueRatio = nonEmpty.length ? unique.size / nonEmpty.length : 0;

  let type = "text";
  if (nonEmpty.length === 0) type = "empty";
  else if (numberConfidence >= 0.9) type = "number";
  else if (dateConfidence >= 0.85) type = "date";
  else if (booleanConfidence >= 0.9) type = "boolean";
  else if (emails.length / nonEmpty.length >= 0.8) type = "email";
  else if (urls.length / nonEmpty.length >= 0.8) type = "url";
  else if (unique.size <= 20 || uniqueRatio <= 0.25) type = "common text";

  return {
    header,
    type,
    total,
    missing,
    nonEmpty,
    rawValues,
    numbers,
    dates,
    uniqueCount: unique.size,
    uniqueRatio,
    example: nonEmpty[0] ?? "",
    stats: buildStats(type, nonEmpty, numbers, dates, total, missing),
  };
}

function buildStats(type, values, numbers, dates, total, missing) {
  const base = {
    missingPct: total ? (missing / total) * 100 : 0,
    count: values.length,
    unique: new Set(values.map((value) => value.toLowerCase())).size,
  };

  if (type === "number") {
    const sorted = [...numbers].sort((a, b) => a - b);
    const sum = numbers.reduce((acc, value) => acc + value, 0);
    const meanValue = numbers.length ? sum / numbers.length : 0;
    const variance =
      numbers.length > 1
        ? numbers.reduce((acc, value) => acc + (value - meanValue) ** 2, 0) /
          (numbers.length - 1)
        : 0;
    return {
      ...base,
      sum,
      mean: meanValue,
      median: median(sorted),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      sampleSd: Math.sqrt(variance),
    };
  }

  if (type === "date") {
    const times = dates.map((date) => date.getTime()).sort((a, b) => a - b);
    return {
      ...base,
      earliest: new Date(times[0]),
      latest: new Date(times[times.length - 1]),
      spanDays: times.length > 1 ? (times[times.length - 1] - times[0]) / 86400000 : 0,
    };
  }

  const counts = frequency(values);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || ["", 0];
  return {
    ...base,
    mode: top[0],
    modeCount: top[1],
    entropy: entropy(counts, values.length),
  };
}

function renderDashboard(model) {
  currentModel = model;
  destroyCharts();
  emptyState.classList.add("hidden");
  dashboard.classList.remove("hidden");
  fileLabel.textContent = model.name;
  dashboardTitle.textContent = "CSV Auto Analysis";
  exportButton.disabled = false;
  printButton.disabled = false;

  allChartCandidates = buildChartCandidates(model);

  renderStats(model);
  renderInsights(model);
  renderTypeFilter(model);
  renderSchema();
  renderCorrelationMatrix(model);
  renderTypeBreakdown(model);
  renderPreview(model);
  renderCharts();
  activateView("overview");
}

function renderStats(model) {
  const numeric = model.profiles.filter((profile) => profile.type === "number").length;
  const dates = model.profiles.filter((profile) => profile.type === "date").length;
  const categories = model.profiles.filter((profile) => profile.type === "common text").length;
  const missingCells = model.profiles.reduce((acc, profile) => acc + profile.missing, 0);
  const totalCells = model.rows.length * model.headers.length;
  const missingPct = totalCells ? (missingCells / totalCells) * 100 : 0;

  statsStrip.innerHTML = [
    stat("Rows", model.rows.length),
    stat("Columns", model.headers.length),
    stat("Numeric", numeric),
    stat("Categories", categories),
    stat("Dates", dates),
    stat("Missing", `${formatNumber(missingPct)}%`),
  ].join("");

  qualityNote.textContent = `First row: ${model.headers
    .slice(0, 3)
    .map((header) => `${header}=${model.firstRow[header]}`)
    .join(" | ")}`;
}

function renderInsights(model) {
  const missingProfile = [...model.profiles].sort((a, b) => b.missing - a.missing)[0];
  const numericProfiles = model.profiles.filter((profile) => profile.type === "number");
  const categoryProfiles = model.profiles.filter((profile) => profile.type === "common text");
  const dateProfiles = model.profiles.filter((profile) => profile.type === "date");
  const strongest = strongestCorrelation(model.rows, numericProfiles);
  const widestRange = [...numericProfiles].sort(
    (a, b) => (b.stats.max - b.stats.min) - (a.stats.max - a.stats.min)
  )[0];
  const topCategory = categoryProfiles
    .map((profile) => ({ profile, dominance: profile.stats.modeCount / Math.max(1, profile.stats.count) }))
    .sort((a, b) => b.dominance - a.dominance)[0];

  const insights = [
    {
      label: "Data quality",
      value: missingProfile ? `${formatNumber(missingProfile.stats.missingPct)}%` : "0%",
      note: missingProfile
        ? `${missingProfile.header} has the highest missing rate.`
        : "No missing-value issue found.",
    },
    {
      label: "Strongest relationship",
      value: strongest ? `r ${formatNumber(strongest.r)}` : "N/A",
      note: strongest ? `${strongest.y} vs ${strongest.x}` : "Need at least two numeric columns.",
    },
    {
      label: "Widest numeric range",
      value: widestRange ? formatNumber(widestRange.stats.max - widestRange.stats.min) : "N/A",
      note: widestRange ? widestRange.header : "No numeric columns detected.",
    },
    {
      label: "Dominant category",
      value: topCategory ? topCategory.profile.stats.mode : "N/A",
      note: topCategory
        ? `${topCategory.profile.header}: ${formatNumber(topCategory.dominance * 100)}% of rows.`
        : "No repeated category fields detected.",
    },
    {
      label: "Date coverage",
      value: dateProfiles[0] ? `${formatNumber(dateProfiles[0].stats.spanDays)} days` : "N/A",
      note: dateProfiles[0] ? dateProfiles[0].header : "No date column detected.",
    },
  ];

  insightGrid.innerHTML = insights
    .map(
      (insight) => `<article class="insight-card">
        <p class="eyebrow">${escapeHtml(insight.label)}</p>
        <strong>${escapeHtml(String(insight.value))}</strong>
        <p>${escapeHtml(insight.note)}</p>
      </article>`
    )
    .join("");
}

function renderTypeFilter(model) {
  const types = [...new Set(model.profiles.map((profile) => profile.type))].sort();
  typeFilter.innerHTML = `<option value="all">All types</option>${types
    .map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`)
    .join("")}`;
}

function renderSchema() {
  if (!currentModel) return;
  const query = columnSearch.value.trim().toLowerCase();
  const selectedType = typeFilter.value;
  const profiles = currentModel.profiles.filter((profile) => {
    const matchesText = !query || profile.header.toLowerCase().includes(query);
    const matchesType = selectedType === "all" || profile.type === selectedType;
    return matchesText && matchesType;
  });

  schemaGrid.innerHTML =
    profiles.map(renderProfileCard).join("") ||
    `<article class="schema-card"><h3>No matching columns</h3><p>Adjust the filters to see fields.</p></article>`;
}

function renderProfileCard(profile) {
  const metrics =
    profile.type === "number"
      ? [
          ["Count", profile.stats.count],
          ["Mean", formatNumber(profile.stats.mean)],
          ["Median", formatNumber(profile.stats.median)],
          ["Sample SD", formatNumber(profile.stats.sampleSd)],
          ["Min", formatNumber(profile.stats.min)],
          ["Max", formatNumber(profile.stats.max)],
        ]
      : profile.type === "date"
        ? [
            ["Count", profile.stats.count],
            ["Earliest", formatDate(profile.stats.earliest)],
            ["Latest", formatDate(profile.stats.latest)],
            ["Span days", formatNumber(profile.stats.spanDays)],
            ["Unique", profile.stats.unique],
            ["Missing %", `${formatNumber(profile.stats.missingPct)}%`],
          ]
        : [
            ["Count", profile.stats.count],
            ["Unique", profile.stats.unique],
            ["Mode", profile.stats.mode || "None"],
            ["Mode count", profile.stats.modeCount || 0],
            ["Entropy", formatNumber(profile.stats.entropy || 0)],
            ["Missing %", `${formatNumber(profile.stats.missingPct)}%`],
          ];

  return `<article class="schema-card">
    <header>
      <h3>${escapeHtml(profile.header)}</h3>
      <span class="badge ${className(profile.type)}">${escapeHtml(profile.type)}</span>
    </header>
    <p>Example: ${escapeHtml(profile.example || "empty")}</p>
    <div class="metric-list">
      ${metrics
        .map(
          ([label, value]) =>
            `<div class="metric"><span>${label}</span><strong>${escapeHtml(String(value))}</strong></div>`
        )
        .join("")}
    </div>
  </article>`;
}

function renderCorrelationMatrix(model) {
  const numericProfiles = model.profiles.filter((profile) => profile.type === "number").slice(0, 8);
  if (numericProfiles.length < 2) {
    correlationMatrix.innerHTML = `<table><tbody><tr><td>Need at least two numeric columns.</td></tr></tbody></table>`;
    return;
  }

  const headerCells = numericProfiles
    .map((profile) => `<th>${escapeHtml(profile.header)}</th>`)
    .join("");
  const rows = numericProfiles
    .map((rowProfile) => {
      const cells = numericProfiles
        .map((colProfile) => {
          const r = correlationForProfiles(model.rows, rowProfile, colProfile);
          const intensity = Math.min(1, Math.abs(r));
          const color = r >= 0 ? `rgba(15, 118, 110, ${intensity})` : `rgba(190, 18, 60, ${intensity})`;
          return `<td class="corr-cell" style="background:${color};color:${intensity > 0.55 ? "#fff" : "inherit"}">${formatNumber(r)}</td>`;
        })
        .join("");
      return `<tr><th>${escapeHtml(rowProfile.header)}</th>${cells}</tr>`;
    })
    .join("");

  correlationMatrix.innerHTML = `<table><thead><tr><th>Column</th>${headerCells}</tr></thead><tbody>${rows}</tbody></table>`;
}

function renderTypeBreakdown(model) {
  const counts = frequency(model.profiles.map((profile) => profile.type));
  const total = model.profiles.length || 1;
  typeBreakdown.innerHTML = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(
      ([type, count]) => `<div class="type-row">
        <strong>${escapeHtml(type)}</strong>
        <div class="type-meter"><span style="width:${(count / total) * 100}%"></span></div>
        <span>${count}</span>
      </div>`
    )
    .join("");
}

function renderPreview(model) {
  const visibleRows = model.rows.slice(0, 50);
  previewCount.textContent = `Showing ${visibleRows.length} of ${model.rows.length} rows`;
  dataPreview.innerHTML = `<table>
    <thead><tr>${model.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>
      ${visibleRows
        .map(
          (row) =>
            `<tr>${model.headers
              .map((header) => `<td>${escapeHtml(normalizeCell(row[header]))}</td>`)
              .join("")}</tr>`
        )
        .join("")}
    </tbody>
  </table>`;
}

function renderCharts() {
  destroyCharts(false);
  if (!currentModel) return;
  const query = chartSearch.value.trim().toLowerCase();
  const family = chartFamily.value;
  const limit = Number(chartLimit.value);
  chartLimitValue.textContent = String(limit);

  const candidates = allChartCandidates
    .filter((candidate) => family === "all" || candidate.family === family)
    .filter(
      (candidate) =>
        !query ||
        candidate.title.toLowerCase().includes(query) ||
        candidate.note.toLowerCase().includes(query)
    )
    .slice(0, limit);

  chartCount.textContent = `${candidates.length} of ${allChartCandidates.length} shown`;
  chartGrid.innerHTML =
    candidates.map(renderChartCard).join("") ||
    `<article class="chart-card"><header><h3>No charts match</h3><p>Adjust the search or chart family filter.</p></header></article>`;

  requestAnimationFrame(() => {
    candidates.forEach((candidate) => {
      const ctx = document.getElementById(candidate.id);
      if (ctx) charts.push(new Chart(ctx, candidate.config));
    });
  });
}

function buildChartCandidates(model) {
  const candidates = [];
  const numberCols = model.profiles.filter((profile) => profile.type === "number");
  const dateCols = model.profiles.filter((profile) => profile.type === "date");
  const categoryCols = model.profiles.filter((profile) => profile.type === "common text");

  addMissingChart(candidates, model.profiles);

  numberCols.forEach((num) => {
    addHistogram(candidates, num);
    addNumericSummary(candidates, num);
  });

  categoryCols.forEach((cat) => {
    addCategoryCount(candidates, cat);
    numberCols.slice(0, 5).forEach((num) => addCategoryAggregate(candidates, model.rows, cat, num));
  });

  dateCols.forEach((dateCol) => {
    numberCols.slice(0, 7).forEach((num) => addTimeSeries(candidates, model.rows, dateCol, num));
  });

  for (let i = 0; i < numberCols.length; i += 1) {
    for (let j = i + 1; j < numberCols.length; j += 1) {
      addScatter(candidates, model.rows, numberCols[i], numberCols[j]);
      if (candidates.length >= MAX_CHARTS + 15) return candidates.sort((a, b) => b.score - a.score);
    }
  }

  categoryCols.slice(0, 5).forEach((catA, index) => {
    categoryCols
      .slice(index + 1, index + 4)
      .forEach((catB) => addCategoryMatrix(candidates, model.rows, catA, catB));
  });

  return candidates.sort((a, b) => b.score - a.score).slice(0, MAX_CHARTS);
}

function addMissingChart(candidates, profiles) {
  candidates.push({
    id: chartId(),
    family: "quality",
    score: 100,
    title: "Missing Cells by Column",
    note: "Quickly identifies fields that may bias downstream analysis.",
    formula: "missing % = missing cells / total rows * 100",
    config: barConfig(
      profiles.map((profile) => profile.header),
      profiles.map((profile) => Number(profile.stats.missingPct.toFixed(2))),
      "Missing %",
      "#be123c"
    ),
  });
}

function addHistogram(candidates, profile) {
  if (profile.numbers.length < 2) return;
  const bins = histogram(profile.numbers, 10);
  candidates.push({
    id: chartId(),
    family: "distribution",
    score: 92 - profile.stats.missingPct,
    title: `${profile.header} Distribution`,
    note: "Shows the shape, spread, and skew of numeric values.",
    formula: "bin width = (max - min) / k; count values where lower <= x < upper",
    config: barConfig(bins.labels, bins.counts, "Frequency", "#0f766e"),
  });
}

function addNumericSummary(candidates, profile) {
  candidates.push({
    id: chartId(),
    family: "summary",
    score: 86 - profile.stats.missingPct,
    title: `${profile.header} Summary`,
    note: "Compares the core descriptive statistics for this measure.",
    formula: "mean = sum(x) / n; median = middle sorted value; sample SD = sqrt(sum((x - mean)^2)/(n - 1))",
    config: barConfig(
      ["Min", "Median", "Mean", "Max"],
      [profile.stats.min, profile.stats.median, profile.stats.mean, profile.stats.max],
      profile.header,
      "#3658a8"
    ),
  });
}

function addCategoryCount(candidates, profile) {
  const entries = topEntries(frequency(profile.nonEmpty), 12);
  if (!entries.length) return;
  candidates.push({
    id: chartId(),
    family: "category",
    score: 88 - profile.uniqueRatio * 20,
    title: `${profile.header} Frequency`,
    note: "Ranks the most common text values in this field.",
    formula: "frequency(category) = count(rows where value = category)",
    config: barConfig(
      entries.map(([label]) => label),
      entries.map(([, count]) => count),
      "Rows",
      "#c2410c"
    ),
  });
}

function addCategoryAggregate(candidates, rows, category, numeric) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = normalizeCell(row[category.header]) || "Missing";
    const value = parseNumber(row[numeric.header]);
    if (!Number.isFinite(value)) return;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(value);
  });
  const entries = [...grouped.entries()]
    .map(([key, values]) => [key, mean(values), values.length])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  if (entries.length < 2) return;
  candidates.push({
    id: chartId(),
    family: "aggregate",
    score: 84 + Math.min(entries.length, 8),
    title: `Average ${numeric.header} by ${category.header}`,
    note: "Uses group means to compare numeric performance across categories.",
    formula: "group mean = sum(values in category) / count(values in category)",
    config: barConfig(
      entries.map(([label]) => label),
      entries.map(([, value]) => Number(value.toFixed(3))),
      `Avg ${numeric.header}`,
      "#4d7c0f"
    ),
  });
}

function addTimeSeries(candidates, rows, dateCol, numeric) {
  const points = rows
    .map((row) => ({
      date: parseDate(row[dateCol.header]),
      value: parseNumber(row[numeric.header]),
    }))
    .filter((point) => point.date && Number.isFinite(point.value))
    .sort((a, b) => a.date - b.date);
  if (points.length < 3) return;
  const grouped = groupByDate(points);
  candidates.push({
    id: chartId(),
    family: "time",
    score: 95,
    title: `${numeric.header} over ${dateCol.header}`,
    note: "Aggregates repeated dates and plots the trend chronologically.",
    formula: "daily value = sum(values on same date); line connects dates ascending",
    config: lineConfig(
      grouped.map(([date]) => date),
      grouped.map(([, value]) => value),
      numeric.header
    ),
  });
}

function addScatter(candidates, rows, xProfile, yProfile) {
  const points = rows
    .map((row) => ({
      x: parseNumber(row[xProfile.header]),
      y: parseNumber(row[yProfile.header]),
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (points.length < 3) return;
  const corr = pearson(points.map((p) => p.x), points.map((p) => p.y));
  candidates.push({
    id: chartId(),
    family: "relationship",
    score: 78 + Math.abs(corr) * 20,
    title: `${yProfile.header} vs ${xProfile.header}`,
    note: `Relationship strength by Pearson r: ${formatNumber(corr)}.`,
    formula: "r = covariance(x,y) / (sample SD(x) * sample SD(y))",
    config: scatterConfig(points, xProfile.header, yProfile.header),
  });
}

function addCategoryMatrix(candidates, rows, catA, catB) {
  const counts = new Map();
  rows.forEach((row) => {
    const a = normalizeCell(row[catA.header]) || "Missing";
    const b = normalizeCell(row[catB.header]) || "Missing";
    const key = `${a} | ${b}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const entries = topEntries(counts, 12);
  if (entries.length < 3) return;
  candidates.push({
    id: chartId(),
    family: "matrix",
    score: 76,
    title: `${catA.header} and ${catB.header}`,
    note: "Highlights the most common category combinations.",
    formula: "combination count = count(rows where category A = a and category B = b)",
    config: barConfig(
      entries.map(([label]) => label),
      entries.map(([, count]) => count),
      "Rows",
      "#a16207"
    ),
  });
}

function barConfig(labels, values, label, color) {
  return {
    type: "bar",
    data: {
      labels,
      datasets: [{ label, data: values, backgroundColor: color, borderRadius: 5 }],
    },
    options: baseOptions(),
  };
}

function lineConfig(labels, values, label) {
  return {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label,
          data: values,
          borderColor: "#3658a8",
          backgroundColor: "rgba(54, 88, 168, 0.12)",
          fill: true,
          tension: 0.25,
          pointRadius: 3,
        },
      ],
    },
    options: baseOptions(),
  };
}

function scatterConfig(points, xLabel, yLabel) {
  return {
    type: "scatter",
    data: {
      datasets: [
        {
          label: `${yLabel} vs ${xLabel}`,
          data: points,
          backgroundColor: "rgba(15, 118, 110, 0.72)",
        },
      ],
    },
    options: {
      ...baseOptions(),
      scales: {
        x: { title: { display: true, text: xLabel }, grid: { color: "#eef2f6" } },
        y: { title: { display: true, text: yLabel }, grid: { color: "#eef2f6" } },
      },
    },
  };
}

function baseOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      x: { ticks: { maxRotation: 45, minRotation: 0 }, grid: { display: false } },
      y: { beginAtZero: true, grid: { color: "#eef2f6" } },
    },
  };
}

function renderChartCard(candidate) {
  return `<article class="chart-card">
    <header>
      <h3>${escapeHtml(candidate.title)}</h3>
      <p>${escapeHtml(candidate.note)}</p>
      <div class="chart-meta">
        <span class="badge">${escapeHtml(candidate.family)}</span>
        <span class="score-pill">fit ${formatNumber(candidate.score)}</span>
      </div>
    </header>
    <div class="chart-frame"><canvas id="${candidate.id}"></canvas></div>
    <div class="formula">${escapeHtml(candidate.formula)}</div>
  </article>`;
}

function activateView(view) {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  document.querySelectorAll(".view-panel").forEach((panel) => {
    panel.classList.toggle("hidden", panel.id !== `${view}-view`);
  });
}

function exportAnalysis() {
  if (!currentModel) return;
  const payload = {
    file: currentModel.name,
    rows: currentModel.rows.length,
    columns: currentModel.headers.length,
    profiles: currentModel.profiles.map((profile) => ({
      header: profile.header,
      type: profile.type,
      missing: profile.missing,
      missingPct: profile.stats.missingPct,
      unique: profile.stats.unique,
      example: profile.example,
      stats: sanitizeStats(profile.stats),
    })),
    recommendedCharts: allChartCandidates.map((chart) => ({
      title: chart.title,
      family: chart.family,
      score: chart.score,
      formula: chart.formula,
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${currentModel.name.replace(/\.csv$/i, "")}-analysis.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function sanitizeStats(stats) {
  return Object.fromEntries(
    Object.entries(stats).map(([key, value]) => [key, value instanceof Date ? formatDate(value) : value])
  );
}

function histogram(values, binCount) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = max === min ? 1 : (max - min) / binCount;
  const counts = Array(binCount).fill(0);
  values.forEach((value) => {
    const index = Math.min(binCount - 1, Math.floor((value - min) / width));
    counts[index] += 1;
  });
  const labels = counts.map((_, index) => {
    const start = min + index * width;
    const end = start + width;
    return `${formatNumber(start)}-${formatNumber(end)}`;
  });
  return { labels, counts };
}

function groupByDate(points) {
  const grouped = new Map();
  points.forEach((point) => {
    const key = formatDate(point.date);
    grouped.set(key, (grouped.get(key) || 0) + point.value);
  });
  return [...grouped.entries()];
}

function frequency(values) {
  const counts = new Map();
  values.forEach((value) => {
    const key = value || "Missing";
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

function topEntries(counts, limit) {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function median(sortedValues) {
  if (!sortedValues.length) return 0;
  const middle = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2
    ? sortedValues[middle]
    : (sortedValues[middle - 1] + sortedValues[middle]) / 2;
}

function mean(values) {
  return values.length ? values.reduce((acc, value) => acc + value, 0) / values.length : 0;
}

function entropy(counts, total) {
  if (!total) return 0;
  return [...counts.values()].reduce((acc, count) => {
    const probability = count / total;
    return acc - probability * Math.log2(probability);
  }, 0);
}

function strongestCorrelation(rows, profiles) {
  let strongest = null;
  for (let i = 0; i < profiles.length; i += 1) {
    for (let j = i + 1; j < profiles.length; j += 1) {
      const r = correlationForProfiles(rows, profiles[i], profiles[j]);
      if (!strongest || Math.abs(r) > Math.abs(strongest.r)) {
        strongest = { x: profiles[i].header, y: profiles[j].header, r };
      }
    }
  }
  return strongest;
}

function correlationForProfiles(rows, xProfile, yProfile) {
  if (xProfile.header === yProfile.header) return 1;
  const points = rows
    .map((row) => ({
      x: parseNumber(row[xProfile.header]),
      y: parseNumber(row[yProfile.header]),
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  return pearson(points.map((point) => point.x), points.map((point) => point.y));
}

function pearson(xs, ys) {
  if (xs.length !== ys.length || xs.length < 2) return 0;
  const meanX = mean(xs);
  const meanY = mean(ys);
  const numerator = xs.reduce((acc, x, index) => acc + (x - meanX) * (ys[index] - meanY), 0);
  const denomX = Math.sqrt(xs.reduce((acc, x) => acc + (x - meanX) ** 2, 0));
  const denomY = Math.sqrt(ys.reduce((acc, y) => acc + (y - meanY) ** 2, 0));
  return denomX && denomY ? numerator / (denomX * denomY) : 0;
}

function parseNumber(value) {
  const text = normalizeCell(value);
  const isPercent = /%$/.test(text);
  const cleaned = text.replace(/[$,]/g, "").replace(/%$/, "");
  if (cleaned === "") return NaN;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return NaN;
  return isPercent ? parsed / 100 : parsed;
}

function parseDate(value) {
  const text = normalizeCell(value);
  if (!text || /^\d+(\.\d+)?$/.test(text)) return null;
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeCell(value) {
  return String(value ?? "").trim();
}

function formatNumber(value) {
  if (!Number.isFinite(Number(value))) return "0";
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(Number(value));
}

function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function stat(label, value) {
  return `<div class="stat"><strong>${escapeHtml(String(value))}</strong><span>${label}</span></div>`;
}

function chartId() {
  chartCounter += 1;
  return `chart-${chartCounter}`;
}

function destroyCharts(clearSchema = true) {
  charts.forEach((chart) => chart.destroy());
  charts = [];
  chartGrid.innerHTML = "";
  if (clearSchema) schemaGrid.innerHTML = "";
}

function className(value) {
  return value.replace(/\s+/g, "-").toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
