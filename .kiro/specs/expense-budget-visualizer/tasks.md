# Implementation Plan

## Overview

This plan implements the Expense & Budget Visualizer — a zero-dependency, client-side SPA built with HTML, CSS, and Vanilla JavaScript. Tasks are ordered so that each module is available before the modules that depend on it.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1"]
    },
    {
      "wave": 2,
      "tasks": ["2"]
    },
    {
      "wave": 3,
      "tasks": ["3"]
    },
    {
      "wave": 4,
      "tasks": ["4", "5"]
    },
    {
      "wave": 5,
      "tasks": ["6"]
    },
    {
      "wave": 6,
      "tasks": ["7"]
    },
    {
      "wave": 7,
      "tasks": ["8"]
    }
  ]
}
```

## Tasks

- [x] 1. Project Scaffolding
  - Create the three application files with their correct directory structure: `index.html` at the workspace root, `css/styles.css`, and `js/app.js`.
  - `index.html` must include the full HTML skeleton described in the design: `<header>` with `#total-balance`, `<main>` with `#form-section` (form + `#form-errors`), `#chart-section` (canvas + `#chart-placeholder`), and `#list-section` (`#transaction-list` + `#list-placeholder`). Include the `#error-banner` div and a `<script src="js/app.js">` tag at the bottom of `<body>`.
  - `css/styles.css` must be linked from `index.html` and contain a baseline reset, layout styles for header/main/sections, responsive media query for narrow viewports (≤ 600 px), and placeholder styles for the error banner, form errors, and list/chart placeholders.
  - `js/app.js` must be created as an empty file (module stubs will be added in subsequent tasks).
  - Verify the file structure matches Requirement 7.3 exactly: one HTML file, one CSS file in `css/`, one JS file in `js/`.

- [x] 2. Implement Validator Module
  - In `js/app.js`, implement the `Validator` object with a single `validate(name, amount, category)` method.
  - `name` validation: required, non-empty after `.trim()`, maximum 100 characters. Error message: `"Name is required."` / `"Name must be 100 characters or fewer."`.
  - `amount` validation: required, must parse as a finite number via `parseFloat`, must be in the range [0.01, 999999999.99] inclusive. Error message: `"Amount is required."` / `"Amount must be a positive number between 0.01 and 999,999,999.99."`.
  - `category` validation: required, must be one of `["Food", "Transport", "Fun"]`. Error message: `"Category is required."` / `"Invalid category."`.
  - Return `{ valid: true }` when all fields pass, or `{ valid: false, errors: { name?, amount?, category? } }` when any field fails.
  - Satisfies Requirements 1.6 and 1.7.

- [x] 3. Implement TransactionStore Module
  - In `js/app.js`, implement the `TransactionStore` object backed by a private `_transactions` array.
  - `add(transaction)`: prepends the transaction to `_transactions` and returns a shallow copy of the array.
  - `delete(id)`: removes the transaction with the matching `id` from `_transactions` and returns a shallow copy.
  - `getAll()`: returns a shallow copy of `_transactions`.
  - `load(transactions)`: replaces `_transactions` with the provided array (used on startup).
  - Each transaction must have: `id` (generated via `crypto.randomUUID()` with `Date.now().toString()` as fallback), `name` (string), `amount` (number), `category` ("Food" | "Transport" | "Fun"), `createdAt` (Date.now() timestamp). The `id` and `createdAt` fields are assigned inside `add()` if not already present.
  - Satisfies Requirements 1.3, 2.3, 3.2, 6.1, 6.2.

- [x] 4. Implement StorageService Module
  - In `js/app.js`, implement the `StorageService` object using the localStorage key `"ebv_transactions"`.
  - `save(transactions)`: calls `JSON.stringify` and `localStorage.setItem`. On any thrown error, re-throw a `StorageError` (a custom `Error` subclass with `name = "StorageError"`).
  - `load()`: calls `localStorage.getItem` and `JSON.parse`. Returns `[]` when the key is absent or the value is `null`. On parse error, re-throw a `StorageError`. Filter out any loaded objects that are missing `id`, `name`, `amount`, or `category` fields, logging a `console.warn` for each filtered entry.
  - Satisfies Requirements 6.1, 6.2, 6.3, 6.4, 6.5.

- [x] 5. Implement UIRenderer and PieChartRenderer Modules
  - In `js/app.js`, implement `PieChartRenderer` with:
    - `draw(canvas, segments)`: clears the canvas, then draws filled arc slices for each segment using the 2D Canvas API. Each segment must display the category name and its rounded percentage (e.g., "Food 42%") as text inside or adjacent to the slice. Category color mapping: Food → `#FF6384`, Transport → `#36A2EB`, Fun → `#FFCE56`.
    - `drawPlaceholder(canvas, message)`: clears the canvas and renders the placeholder message as centered text.
  - In `js/app.js`, implement `UIRenderer` with:
    - `render(transactions)`: calls `renderTotalBalance`, `renderTransactionList`, and `renderPieChart` in sequence.
    - `renderTotalBalance(transactions)`: sums all `amount` values and writes the result to `#total-balance` formatted as `"Total: $X.XX"` with exactly two decimal places. Displays `"Total: $0.00"` for an empty array.
    - `renderTransactionList(transactions)`: clears `#transaction-list` and re-renders one `<li>` per transaction showing name, formatted amount (`"$X.XX"`), and category. Each `<li>` must include a delete `<button>` with `data-id` set to the transaction's `id`. Shows `#list-placeholder` when the array is empty, hides it otherwise.
    - `renderPieChart(transactions)`: computes per-category sums and calls `PieChartRenderer.draw` with the resulting segments. Shows `#chart-placeholder` and calls `PieChartRenderer.drawPlaceholder` when there are no transactions or no transactions with valid categories.
    - `showFormErrors(errors)`: injects inline error `<span>` elements into `#form-errors` for each error key.
    - `clearFormErrors()`: empties `#form-errors`.
    - `showErrorBanner(message)`: sets the text of `#error-banner`, removes the `hidden` attribute, and schedules `hideErrorBanner()` after 5 seconds.
    - `hideErrorBanner()`: adds the `hidden` attribute back to `#error-banner`.
  - Satisfies Requirements 2.1, 2.4, 4.1, 4.5, 5.1, 5.5, 5.6, 5.7.

- [x] 6. Implement FormController Module
  - In `js/app.js`, implement `FormController` with an `init()` method that attaches a `submit` event listener to `#transaction-form`.
  - On submit: call `event.preventDefault()`, read values from `#item-name`, `#item-amount`, and `#item-category`, call `Validator.validate()`.
  - If validation fails: call `UIRenderer.showFormErrors(errors)` and return early (no store mutation, no localStorage write).
  - If validation passes: call `UIRenderer.clearFormErrors()`, call `TransactionStore.add(transaction)`, call `StorageService.save(TransactionStore.getAll())` inside a try/catch — on `StorageError` call `UIRenderer.showErrorBanner(message)`. Call `UIRenderer.render(TransactionStore.getAll())`. Reset the form fields: `#item-name` and `#item-amount` to `""`, `#item-category` to `"Food"`.
  - Satisfies Requirements 1.3, 1.4, 1.5, 1.6, 1.7, 4.2, 5.2, 6.1, 6.5.

- [x] 7. Implement ListController Module
  - In `js/app.js`, implement `ListController` with an `init()` method that attaches a delegated `click` event listener to `#transaction-list`.
  - On click: check if the clicked element is a `<button>` with a `data-id` attribute. If so, read the `data-id` value, call `TransactionStore.delete(id)`, call `StorageService.save(TransactionStore.getAll())` inside a try/catch — on `StorageError` call `UIRenderer.showErrorBanner(message)`. Call `UIRenderer.render(TransactionStore.getAll())`.
  - Satisfies Requirements 3.1, 3.2, 3.3, 3.4, 4.3, 5.3, 6.2.

- [x] 8. Implement Application Initialisation
  - At the bottom of `js/app.js`, add a `DOMContentLoaded` event listener that runs the startup sequence:
    1. Call `StorageService.load()` inside a try/catch. On `StorageError`, call `UIRenderer.showErrorBanner(message)` and use an empty array as the initial data.
    2. Call `TransactionStore.load(transactions)` with the loaded (or empty) array.
    3. Call `UIRenderer.render(TransactionStore.getAll())` to paint the initial state.
    4. Call `FormController.init()`.
    5. Call `ListController.init()`.
  - Satisfies Requirements 2.3, 4.4, 5.4, 6.3, 6.4.

## Notes

- All application logic lives in a single `js/app.js` file — no ES modules, no bundler. Modules Zare plain JavaScript objects/functions in the global scope.
- Smoke tests (browser load time, cross-browser compatibility, scroll behaviour) are manual and not automated.
