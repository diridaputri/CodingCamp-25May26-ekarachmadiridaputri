# Design Document

## Overview

The Expense & Budget Visualizer is a purely client-side single-page application (SPA) built with HTML, CSS, and Vanilla JavaScript. There is no build step, no framework, and no backend. The entire application ships as three files:

- `index.html` — markup and entry point
- `css/styles.css` — all styling and responsive layout
- `js/app.js` — all application logic

The app lets users record expense transactions (name, amount, category), view them in a scrollable list, see a running total balance, and visualize spending by category in a canvas-drawn pie chart. All data is persisted in the browser's `localStorage` so it survives page reloads and browser restarts.

### Design Goals

- **Zero dependencies** — no libraries, no CDN scripts, no package manager required.
- **Immediate feedback** — all UI updates (balance, list, chart) happen within 100 ms of a user action.
- **Resilient persistence** — `localStorage` errors are caught and surfaced to the user; the app never silently loses data.
- **Accessible and responsive** — the layout adapts to narrow viewports; interactive elements are keyboard-accessible.

---

## Architecture

The application follows a simple **unidirectional data flow** pattern:

```
User Action
    │
    ▼
Input Validation (Validator)
    │
    ▼
State Mutation (TransactionStore)
    │
    ▼
Persistence (StorageService)
    │
    ▼
UI Render (UIRenderer)
    ├── renderTransactionList()
    ├── renderTotalBalance()
    └── renderPieChart()
```

All state lives in a single in-memory array (`transactions`). Every add or delete operation:
1. Validates input (if applicable).
2. Mutates the in-memory array.
3. Persists the array to `localStorage`.
4. Triggers a full re-render of all three UI regions.

Because the dataset is small (personal expense tracking) and the render functions are lightweight, a full re-render on every mutation is fast enough to comfortably meet the 100 ms requirement without any diffing or virtual DOM.

### Module Responsibilities

| Module | Responsibility |
|---|---|
| `Validator` | Validates form field values before submission |
| `TransactionStore` | Holds the in-memory transaction array; exposes add/delete/getAll |
| `StorageService` | Wraps `localStorage` read/write with error handling |
| `UIRenderer` | Reads from `TransactionStore` and updates the DOM and canvas |
| `PieChartRenderer` | Draws the pie chart onto a `<canvas>` element |
| `FormController` | Handles form submit event, wires Validator → TransactionStore → UIRenderer |
| `ListController` | Handles delete button clicks, wires TransactionStore → UIRenderer |

All modules are plain JavaScript objects/functions defined in `js/app.js`. No ES modules or bundler is required — the file is loaded as a single `<script>` tag at the bottom of `<body>`.

---

## Components and Interfaces

### HTML Structure (`index.html`)

```
<body>
  <header>
    <h1>Expense & Budget Visualizer</h1>
    <div id="total-balance">Total: $0.00</div>
  </header>

  <main>
    <section id="form-section">
      <form id="transaction-form">
        <input  id="item-name"   type="text"   maxlength="100" />
        <input  id="item-amount" type="number" step="0.01" />
        <select id="item-category">
          <option value="Food">Food</option>
          <option value="Transport">Transport</option>
          <option value="Fun">Fun</option>
        </select>
        <button type="submit">Add Transaction</button>
      </form>
      <div id="form-errors" aria-live="polite"></div>
    </section>

    <section id="chart-section">
      <canvas id="pie-chart" width="300" height="300"></canvas>
      <div id="chart-placeholder" hidden>No spending data to display.</div>
    </section>

    <section id="list-section">
      <ul id="transaction-list" aria-label="Transaction list"></ul>
      <p id="list-placeholder">No transactions yet.</p>
    </section>
  </main>

  <div id="error-banner" role="alert" aria-live="assertive" hidden></div>
  <script src="js/app.js"></script>
</body>
```

### Validator

```js
Validator.validate(name, amount, category)
  → { valid: true }
  → { valid: false, errors: { name?: string, amount?: string, category?: string } }
```

Rules:
- `name`: required, non-empty after trim, max 100 characters.
- `amount`: required, must parse as a finite number, must be in range [0.01, 999999999.99].
- `category`: required, must be one of `["Food", "Transport", "Fun"]`.

### TransactionStore

```js
TransactionStore.add(transaction)    // prepends to array, returns new array
TransactionStore.delete(id)          // removes by id, returns new array
TransactionStore.getAll()            // returns copy of array
TransactionStore.load(transactions)  // replaces array (used on startup)
```

Each transaction object:
```js
{
  id:       string,   // crypto.randomUUID() or Date.now().toString() fallback
  name:     string,
  amount:   number,
  category: "Food" | "Transport" | "Fun",
  createdAt: number   // Date.now() timestamp
}
```

### StorageService

```js
StorageService.save(transactions)   // JSON.stringify → localStorage; throws on failure
StorageService.load()               // JSON.parse ← localStorage; returns [] on empty; throws on parse error
```

### UIRenderer

```js
UIRenderer.render(transactions)
  // calls renderTotalBalance, renderTransactionList, renderPieChart
UIRenderer.renderTotalBalance(transactions)
UIRenderer.renderTransactionList(transactions)
UIRenderer.renderPieChart(transactions)
UIRenderer.showFormErrors(errors)
UIRenderer.clearFormErrors()
UIRenderer.showErrorBanner(message)
UIRenderer.hideErrorBanner()
```

### PieChartRenderer

```js
PieChartRenderer.draw(canvas, segments)
  // segments: [{ label: string, value: number, color: string }]
PieChartRenderer.drawPlaceholder(canvas, message)
```

Draws directly onto a `<canvas>` element using the 2D Canvas API. No third-party charting library is used.

---

## Data Models

### Transaction

```js
/**
 * @typedef {Object} Transaction
 * @property {string}  id        - Unique identifier (UUID or timestamp string)
 * @property {string}  name      - Item name (1–100 characters, trimmed)
 * @property {number}  amount    - Positive number in range [0.01, 999999999.99]
 * @property {"Food"|"Transport"|"Fun"} category - Spending category
 * @property {number}  createdAt - Unix timestamp (ms) of when the transaction was created
 */
```

### Persisted Format

Transactions are stored in `localStorage` under the key `"ebv_transactions"` as a JSON-serialized array of `Transaction` objects:

```json
[
  {
    "id": "1717000000000",
    "name": "Lunch",
    "amount": 12.50,
    "category": "Food",
    "createdAt": 1717000000000
  }
]
```

### PieChart Segment

```js
/**
 * @typedef {Object} PieSegment
 * @property {string} label      - Category name
 * @property {number} value      - Sum of amounts for this category
 * @property {string} color      - Hex color string
 * @property {number} percentage - Rounded percentage of total (0–100)
 */
```

Category color mapping:
| Category  | Color   |
|-----------|---------|
| Food      | #FF6384 |
| Transport | #36A2EB |
| Fun       | #FFCE56 |

### Validation Error Map

```js
/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {{ name?: string, amount?: string, category?: string }} [errors]
 */
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid transaction submission grows the list

*For any* valid transaction input (non-empty name ≤ 100 chars, amount in [0.01, 999999999.99], valid category), submitting the form shall result in the transaction list length increasing by exactly 1 and the new transaction appearing at index 0 (top of the list).

**Validates: Requirements 1.3**

---

### Property 2: Transaction add/delete round-trips through LocalStorage

*For any* sequence of add and delete operations on valid transactions, the contents of `localStorage["ebv_transactions"]` shall always equal the current in-memory transaction array (same ids, same order).

**Validates: Requirements 1.4, 3.3, 6.1, 6.2**

---

### Property 3: Form resets after valid submission

*For any* valid transaction input, after the form is submitted successfully, the item name field shall be empty, the amount field shall be empty, and the category dropdown shall be set to "Food".

**Validates: Requirements 1.5**

---

### Property 4: Validator rejects invalid inputs

*For any* form submission where one or more fields are empty or the amount is outside [0.01, 999999999.99], the Validator shall return `valid: false` and include an error entry for each invalid field, and the transaction list shall remain unchanged.

**Validates: Requirements 1.6, 1.7**

---

### Property 5: Transaction list renders all required fields

*For any* non-empty array of transactions, the rendered transaction list shall contain one list item per transaction, and each item's text content shall include the transaction's name, the amount formatted as a currency string with exactly two decimal places (e.g., "$12.50"), and the category label.

**Validates: Requirements 2.1**

---

### Property 6: Transaction list preserves most-recent-first order on load

*For any* array of transactions saved to LocalStorage (in the order they were added), after the application initialises from LocalStorage the displayed list shall show transactions in most-recent-first order (index 0 = most recently added).

**Validates: Requirements 2.3**

---

### Property 7: Delete button present for every transaction

*For any* non-empty array of transactions, the rendered transaction list shall contain exactly one activatable delete button per transaction entry.

**Validates: Requirements 3.1**

---

### Property 8: Delete removes exactly the targeted transaction

*For any* non-empty transaction array and any transaction id in that array, after deleting that transaction the resulting array shall contain every other transaction unchanged and shall not contain the deleted transaction's id.

**Validates: Requirements 3.2, 3.3**

---

### Property 9: Total balance equals sum of all transaction amounts

*For any* array of transactions (including the empty array), the displayed Total_Balance value shall equal the arithmetic sum of all transaction amounts, formatted as a currency string with exactly two decimal places.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

---

### Property 10: Pie chart segments correctly represent category distribution

*For any* non-empty array of transactions containing at least one transaction with a valid category (Food, Transport, Fun), the computed pie chart segments shall satisfy:
- One segment per category that has at least one transaction.
- Each segment's `value` equals the sum of amounts for that category.
- Each segment's `percentage` equals `Math.round(categorySum / totalSum * 100)`.
- The sum of all segment percentages is within ±1 of 100 (rounding tolerance).
- Each segment includes the category name as its label.

**Validates: Requirements 5.1, 5.7**

---

### Property 11: Full application state restores from LocalStorage on load

*For any* array of transactions saved to LocalStorage, after the application initialises the transaction list, total balance, and pie chart shall all reflect the saved data exactly — as if those transactions had just been added in the current session.

**Validates: Requirements 6.3, 2.3, 4.4, 5.4**

---

## Error Handling

### LocalStorage Write Failure

When `localStorage.setItem` throws (e.g., storage quota exceeded or private browsing restrictions), `StorageService.save()` catches the error and re-throws a typed `StorageError`. The calling controller catches this and calls `UIRenderer.showErrorBanner(message)` to display a non-blocking error banner. The in-memory state is already updated, so the UI reflects the change for the current session even though it was not persisted.

### LocalStorage Read / Parse Failure

On startup, `StorageService.load()` wraps `JSON.parse` in a try/catch. If parsing fails, it throws a `StorageError`. The app initialisation code catches this, calls `UIRenderer.showErrorBanner(message)`, and initialises `TransactionStore` with an empty array. The user sees a clear error message and a working (empty) app rather than a broken one.

### Validation Errors

`Validator.validate()` returns a `ValidationResult` object. If `valid` is `false`, `FormController` calls `UIRenderer.showFormErrors(errors)` which injects inline error messages next to each invalid field. The `aria-live="polite"` region ensures screen readers announce the errors. No transaction is added and no localStorage write occurs.

### Unknown / Corrupted Transaction Data

If a loaded transaction object is missing required fields (e.g., no `id`, no `amount`), `StorageService.load()` filters out malformed entries and logs a console warning. The app continues with the valid subset of data.

### Error Banner Dismissal

The error banner (`#error-banner`) is shown with `hidden` removed and dismissed automatically after 5 seconds, or immediately when the user performs a successful operation.

---

## Testing Strategy

### Approach

The application uses a **dual testing approach**:

1. **Unit / example-based tests** — verify specific scenarios, edge cases, and error conditions using concrete inputs.
2. **Property-based tests** — verify universal properties across many randomly generated inputs.

Because the application is pure client-side JavaScript with no build step, tests are written using **[fast-check](https://github.com/dubzzz/fast-check)** (property-based testing) and a lightweight test runner such as **[Vitest](https://vitest.dev/)** (or plain Node.js with `assert` if no build tooling is desired). All logic modules (`Validator`, `TransactionStore`, `StorageService`, `PieChartRenderer` data computation) are pure functions or easily mockable, making them straightforward to test without a browser.

Each property-based test is configured to run a **minimum of 100 iterations**.

### Unit Tests (Example-Based)

| Test | Covers |
|---|---|
| Form renders three category options: Food, Transport, Fun | Req 1.2 |
| Empty transaction list shows placeholder message | Req 2.4 |
| Empty state shows $0.00 balance | Req 4.5 |
| Empty state shows pie chart placeholder | Req 5.5 |
| Transactions with no valid categories show pie chart placeholder | Req 5.6 |
| Corrupt localStorage shows error banner and empty state on load | Req 6.4 |
| localStorage write failure shows error banner on add | Req 6.5 |
| localStorage write failure shows error banner on delete | Req 3.4 |

### Property-Based Tests

Each test references its design property via a comment tag:
`// Feature: expense-budget-visualizer, Property N: <property_text>`

| Property | Test Description | Iterations |
|---|---|---|
| Property 1 | For any valid transaction input, submitting grows list by 1 and places item at index 0 | 100 |
| Property 2 | For any add/delete sequence, localStorage contents equal in-memory array | 100 |
| Property 3 | For any valid submission, form fields reset to empty / "Food" | 100 |
| Property 4 | For any invalid input combination, Validator returns errors and list is unchanged | 100 |
| Property 5 | For any transaction array, rendered list items contain name, formatted amount, category | 100 |
| Property 6 | For any saved transaction array, loaded list order is most-recent-first | 100 |
| Property 7 | For any non-empty transaction array, each rendered item has a delete button | 100 |
| Property 8 | For any array and any id, deleting that id removes exactly that transaction | 100 |
| Property 9 | For any transaction array, displayed balance equals sum of amounts formatted to 2dp | 100 |
| Property 10 | For any transaction array, pie segments have correct values, percentages, and labels | 100 |
| Property 11 | For any saved transaction array, app load restores list, balance, and chart correctly | 100 |

### Smoke Tests (Manual / Browser)

- Application loads within 3 seconds on Chrome, Firefox, Edge, Safari (last 2 major versions).
- Transaction list scrolls when content overflows its container.
- File structure is exactly `index.html`, `css/styles.css`, `js/app.js`.
- UI interactions respond within 100 ms (verified by manual interaction and browser DevTools performance panel).

### Test Generators (fast-check arbitraries)

```js
// Valid transaction arbitrary
const validTransaction = fc.record({
  name:     fc.string({ minLength: 1, maxLength: 100 }).map(s => s.trim()).filter(s => s.length > 0),
  amount:   fc.float({ min: 0.01, max: 999999999.99, noNaN: true }),
  category: fc.constantFrom("Food", "Transport", "Fun"),
});

// Invalid amount arbitrary
const invalidAmount = fc.oneof(
  fc.constant(0),
  fc.float({ max: -0.01 }),
  fc.float({ min: 1000000000 }),
  fc.string().filter(s => isNaN(parseFloat(s))),
);

// Non-empty transaction array arbitrary
const transactionArray = fc.array(validTransaction, { minLength: 1, maxLength: 50 });
```
