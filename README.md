# CSV Insight Dashboard

A standalone web application that turns any CSV file into an auto-generated dashboard.

## Run

Open `index.html` in a browser, or serve the folder locally:

```powershell
python -m http.server 5173
```

Then visit `http://127.0.0.1:5173`.

## What It Does

- Reads CSV headers with PapaParse.
- Uses the first data row as the schema example.
- Profiles every column across all rows.
- Detects `number`, `date`, `boolean`, `email`, `url`, `common text`, `text`, and `empty` columns.
- Computes mathematically explicit statistics.
- Auto-selects up to 40 charts with Chart.js.
- Generates executive insight cards.
- Builds a numeric correlation matrix.
- Shows a type breakdown and first 50-row data preview.
- Filters columns by search and inferred type.
- Filters charts by family, search term, and chart count.
- Exports the computed analysis as JSON.
- Supports browser printing for reports.

## Core Formulas

- `mean = sum(x) / n`
- `median = middle sorted value`, or average of the two middle values when `n` is even
- `sample variance = sum((x - mean)^2) / (n - 1)`
- `sample standard deviation = sqrt(sample variance)`
- `missing percent = missing cells / total rows * 100`
- `cardinality = count(unique non-empty values)`
- `category frequency = count(rows where value = category)`
- `group mean = sum(values in category) / count(values in category)`
- `Pearson r = covariance(x, y) / (sample SD(x) * sample SD(y))`
- `entropy = -sum(p_i * log2(p_i))`

## Chart Selection Logic

The app scores chart candidates by data quality and chart fit:

- Numeric columns get histograms and descriptive-stat charts.
- Date plus numeric columns get time-series charts.
- Common text columns get frequency charts.
- Common text plus numeric columns get grouped-average charts.
- Numeric pairs get scatter charts ranked by absolute Pearson correlation.
- Category pairs get combination-frequency charts.
- Every dataset gets a missing-data chart.

## Interface

- `Overview`: summary metrics, insight cards, type breakdown, and correlation matrix.
- `Columns`: searchable schema cards with type-specific metrics.
- `Charts`: recommended charts with family/search/count filters.
- `Preview`: the first 50 parsed rows for fast data validation.

The highest-scoring 40 candidates are rendered automatically.
