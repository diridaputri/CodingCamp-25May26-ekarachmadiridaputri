// js/app.js
// Expense & Budget Visualizer — application logic

// ---------------------------------------------------------------------------
// SortService
// Sorts transactions based on the user's selection from the dropdown.
// ---------------------------------------------------------------------------
const SortService = {
  /** @type {string} */
  currentSort: 'newest',
  sort(transactions) {
    const sorted = [...transactions];
    switch (this.currentSort) {
      case 'newest':
        return sorted.sort((a, b) => b.createdAt - a.createdAt);
      case 'oldest':
        return sorted.sort((a, b) => a.createdAt - b.createdAt);
      case 'amount-desc':
        return sorted.sort((a, b) => b.amount - a.amount);
      case 'amount-asc':
        return sorted.sort((a, b) => a.amount - b.amount);
      default:
        return sorted;
    }
  },
};

// ---------------------------------------------------------------------------
// BudgetService
// Manages the user's budget limit and over-budget detection.
// ---------------------------------------------------------------------------  

// ---------------------------------------------------------------------------
// Validator
// Validates form field values before submission.
// ---------------------------------------------------------------------------
const Validator = {
  /**
   * Validates the three transaction form fields.
   *
   * @param {string} name     - Item name value from the form field.
   * @param {string} amount   - Amount value from the form field (raw string).
   * @param {string} category - Category value from the form field.
   * @returns {{ valid: true } | { valid: false, errors: { name?: string, amount?: string, category?: string } }}
   */
  validate(name, amount, category) {
    const errors = {};

    // --- name validation ---
    const trimmedName = (name == null ? '' : String(name)).trim();
    if (trimmedName.length === 0) {
      errors.name = 'Name is required.';
    } else if (trimmedName.length > 100) {
      errors.name = 'Name must be 100 characters or fewer.';
    }

    // --- amount validation ---
    const amountStr = (amount == null ? '' : String(amount)).trim();
    if (amountStr.length === 0) {
      errors.amount = 'Amount is required.';
    } else {
      const parsed = parseFloat(amountStr);
      if (!isFinite(parsed) || parsed < 0.01 || parsed > 999999999.99) {
        errors.amount = 'Amount must be a positive number between 0.01 and 999,999,999.99.';
      }
    }

    // --- category validation ---
    const validCategories = ['Food', 'Transport', 'Fun',];
    if (category == null || String(category).trim().length === 0) {
      errors.category = 'Category is required.';
    } else if (!validCategories.includes(String(category))) {
      errors.category = 'Invalid category.';
    }

    if (Object.keys(errors).length === 0) {
      return { valid: true };
    }
    return { valid: false, errors };
  },
};

// ---------------------------------------------------------------------------
// TransactionStore
// Holds the in-memory transaction array; exposes add / delete / getAll / load.
// ---------------------------------------------------------------------------
const TransactionStore = (() => {
  /** @type {Array<{id: string, name: string, amount: number, category: string, createdAt: number}>} */
  let _transactions = [];

  return {
    /**
     * Prepends a transaction to the store.
     * Assigns `id` (via crypto.randomUUID or Date.now fallback) and `createdAt`
     * if they are not already present on the object.
     *
     * @param {{ name: string, amount: number, category: string, id?: string, createdAt?: number }} transaction
     * @returns {Array} Shallow copy of the updated transactions array.
     */
    add(transaction) {
      const id =
        transaction.id != null
          ? transaction.id
          : typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : Date.now().toString();

      const createdAt =
        transaction.createdAt != null ? transaction.createdAt : Date.now();

      const entry = {
        id,
        name: transaction.name,
        amount: transaction.amount,
        category: transaction.category,
        createdAt,
      };

      _transactions = [entry, ..._transactions];
      return [..._transactions];
    },

    /**
     * Removes the transaction with the given id from the store.
     *
     * @param {string} id - The id of the transaction to remove.
     * @returns {Array} Shallow copy of the updated transactions array.
     */
    delete(id) {
      _transactions = _transactions.filter((t) => t.id !== id);
      return [..._transactions];
    },

    /**
     * Returns a shallow copy of the current transactions array.
     *
     * @returns {Array}
     */
    getAll() {
      return [..._transactions];
    },

    /**
     * Replaces the internal array with the provided transactions.
     * Used on application startup to restore persisted data.
     *
     * @param {Array} transactions
     */
    load(transactions) {
      _transactions = Array.isArray(transactions) ? [...transactions] : [];
    },
  };
})();

// ---------------------------------------------------------------------------
// StorageError
// Custom Error subclass used by StorageService to signal persistence failures.
// ---------------------------------------------------------------------------
class StorageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StorageError';
  }
}

// ---------------------------------------------------------------------------
// StorageService
// Wraps localStorage read/write with error handling.
// Key: "ebv_transactions"
// ---------------------------------------------------------------------------
const StorageService = {
  /** @type {string} */
  _key: 'ebv_transactions',

  /**
   * Serialises the transactions array and writes it to localStorage.
   * Re-throws any error as a StorageError.
   *
   * @param {Array} transactions
   * @throws {StorageError}
   */
  save(transactions) {
    try {
      const serialised = JSON.stringify(transactions);
      localStorage.setItem(this._key, serialised);
    } catch (err) {
      throw new StorageError(
        `Failed to save transactions: ${err && err.message ? err.message : String(err)}`
      );
    }
  },

  /**
   * Reads and parses the transactions array from localStorage.
   * Returns [] when the key is absent or the stored value is null.
   * Filters out objects that are missing id, name, amount, or category fields,
   * logging a console.warn for each filtered entry.
   * Re-throws any parse error as a StorageError.
   *
   * @returns {Array}
   * @throws {StorageError}
   */
  load() {
    const raw = localStorage.getItem(this._key);

    // Key absent or value is null → return empty array (Req 6.3 default state)
    if (raw === null) {
      return [];
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new StorageError(
        `Failed to parse stored transactions: ${err && err.message ? err.message : String(err)}`
      );
    }

    // If the parsed value is not an array, treat it as corrupt data
    if (!Array.isArray(parsed)) {
      throw new StorageError('Stored transaction data is not a valid array.');
    }

    // Filter out entries that are missing required fields (Req 6.3 / design error-handling)
    const requiredFields = ['id', 'name', 'amount', 'category'];
    const valid = parsed.filter((entry) => {
      if (entry === null || typeof entry !== 'object') {
        console.warn('[StorageService] Filtered out non-object entry:', entry);
        return false;
      }
      const missingFields = requiredFields.filter((f) => !(f in entry));
      if (missingFields.length > 0) {
        console.warn(
          `[StorageService] Filtered out transaction missing fields [${missingFields.join(', ')}]:`,
          entry
        );
        return false;
      }
      return true;
    });

    return valid;
  },
};

// ---------------------------------------------------------------------------
// PieChartRenderer
// Draws the pie chart onto a <canvas> element using the 2D Canvas API.
// ---------------------------------------------------------------------------
const PieChartRenderer = {
  /** @type {{ [category: string]: string }} */
  _colorMap: {
    Food: '#6FAF4F',
    Transport: '#36A2EB',
    Fun: '#FFCE56',
  },

  /**
   * Clears the canvas and draws filled arc slices for each segment.
   * Each segment displays the category name and its rounded percentage
   * as text inside or adjacent to the slice.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {Array<{ label: string, value: number, color: string, percentage: number }>} segments
   */
  draw(canvas, segments) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear the canvas
    ctx.clearRect(0, 0, width, height);

    if (!segments || segments.length === 0) {
      return;
    }

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(cx, cy) * 0.65;
    const labelRadius = Math.min(cx, cy) * 0.65;

    let startAngle = -Math.PI / 2; // Start from the top

    segments.forEach((segment) => {
      const sliceAngle = (segment.percentage / 100) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;

      // Draw the filled arc slice
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = segment.color;
      ctx.fill();

      // Draw a thin white border between slices
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw the label text (category name + percentage)
      const midAngle = startAngle + sliceAngle / 2;
      const textX = cx + labelRadius * Math.cos(midAngle);
      const textY = cy + labelRadius * Math.sin(midAngle);

      const label = `${segment.label} ${segment.percentage}%`;

      const isDarkMode = document.body.classList.contains('dark-mode');
      ctx.fillStyle = isDarkMode ? '#f0f0f0' : '#333333';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, textX, textY);

      startAngle = endAngle;
    });
  },

  /**
   * Clears the canvas and renders the placeholder message as centered text.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {string} message
   */
  drawPlaceholder(canvas, message) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear the canvas
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#888888';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, width / 2, height / 2);
  },
};

// ---------------------------------------------------------------------------
// UIRenderer
// Reads from TransactionStore and updates the DOM and canvas.
// ---------------------------------------------------------------------------
const UIRenderer = {
  /**
   * Calls renderTotalBalance, renderTransactionList, and renderPieChart
   * in sequence.
   *
   * @param {Array<{ id: string, name: string, amount: number, category: string, createdAt: number }>} transactions
   */
  render(transactions) {
  const sorted = SortService.sort(transactions);
  this.renderTotalBalance(sorted);
  this.renderTransactionList(sorted);
  this.renderPieChart(sorted);
},

  /**
   * Sums all amount values and writes the result to #total-balance
   * formatted as "Total: $X.XX" with exactly two decimal places.
   * Displays "Total: $0.00" for an empty array.
   *
   * @param {Array<{ amount: number }>} transactions
   */
  renderTotalBalance(transactions) {
  const total = Array.isArray(transactions)
    ? transactions.reduce((sum, t) => sum + (typeof t.amount === 'number' ? t.amount : 0), 0)
    : 0;

  const el = document.getElementById('total-balance');
  if (el) {
    el.textContent = `Total: $${total.toFixed(2)}`;
  }
},

  /**
   * Clears #transaction-list and re-renders one <li> per transaction
   * showing name, formatted amount ("$X.XX"), and category.
   * Each <li> includes a delete <button> with data-id set to the transaction's id.
   * Shows #list-placeholder when the array is empty, hides it otherwise.
   *
   * @param {Array<{ id: string, name: string, amount: number, category: string }>} transactions
   */
  renderTransactionList(transactions) {
    const list = document.getElementById('transaction-list');
    const placeholder = document.getElementById('list-placeholder');

    if (!list) return;

    // Clear existing items
    list.innerHTML = '';

    if (!Array.isArray(transactions) || transactions.length === 0) {
      if (placeholder) placeholder.removeAttribute('hidden');
      return;
    }

    // Hide placeholder when there are transactions
    if (placeholder) placeholder.setAttribute('hidden', '');

    transactions.forEach((transaction) => {
      const li = document.createElement('li');

      const formattedAmount = `$${Number(transaction.amount).toFixed(2)}`;

      li.innerHTML = `
        <span class="transaction-name">${_escapeHtml(transaction.name)}</span>
        <span class="transaction-amount">${formattedAmount}</span>
        <span class="transaction-category">${_escapeHtml(transaction.category)}</span>
        <button class="delete-btn" data-id="${_escapeHtml(transaction.id)}" aria-label="Delete ${_escapeHtml(transaction.name)}">Delete</button>
      `;

      list.appendChild(li);
    });
  },

  /**
   * Computes per-category sums and calls PieChartRenderer.draw with the
   * resulting segments. Shows #chart-placeholder and calls
   * PieChartRenderer.drawPlaceholder when there are no transactions or no
   * transactions with valid categories.
   *
   * @param {Array<{ amount: number, category: string }>} transactions
   */
  renderPieChart(transactions) {
    const canvas = document.getElementById('pie-chart');
    const placeholder = document.getElementById('chart-placeholder');

    const validCategories = ['Food', 'Transport', 'Fun',];
    const colorMap = PieChartRenderer._colorMap;

    const showPlaceholder = (message) => {
      if (placeholder) placeholder.removeAttribute('hidden');
      if (canvas) PieChartRenderer.drawPlaceholder(canvas, message);
    };

    if (!Array.isArray(transactions) || transactions.length === 0) {
      showPlaceholder('No spending data to display.');
      return;
    }

    // Filter to only valid-category transactions
    const validTransactions = transactions.filter(
      (t) => validCategories.includes(t.category)
    );

    if (validTransactions.length === 0) {
      showPlaceholder('No trackable spending data available.');
      return;
    }

    // Compute per-category sums
    const categorySums = {};
    validTransactions.forEach((t) => {
      categorySums[t.category] = (categorySums[t.category] || 0) + t.amount;
    });

    const total = Object.values(categorySums).reduce((sum, v) => sum + v, 0);

    // Build segments
    const segments = Object.entries(categorySums).map(([category, value]) => ({
      label: category,
      value,
      color: colorMap[category],
      percentage: Math.round((value / total) * 100),
    }));

    // Hide placeholder and draw the chart
    if (placeholder) placeholder.setAttribute('hidden', '');
    if (canvas) PieChartRenderer.draw(canvas, segments);
  },

  /**
   * Injects inline error <span> elements into #form-errors for each error key.
   *
   * @param {{ name?: string, amount?: string, category?: string }} errors
   */
  showFormErrors(errors) {
    const container = document.getElementById('form-errors');
    if (!container) return;

    container.innerHTML = '';

    if (!errors || typeof errors !== 'object') return;

    Object.entries(errors).forEach(([field, message]) => {
      const span = document.createElement('span');
      span.className = `form-error form-error--${field}`;
      span.setAttribute('role', 'alert');
      span.textContent = message;
      container.appendChild(span);
    });
  },

  /**
   * Empties #form-errors.
   */
  clearFormErrors() {
    const container = document.getElementById('form-errors');
    if (container) {
      container.innerHTML = '';
    }
  },

  /**
   * Sets the text of #error-banner, removes the hidden attribute,
   * and schedules hideErrorBanner() after 5 seconds.
   *
   * @param {string} message
   */
  showErrorBanner(message) {
    const banner = document.getElementById('error-banner');
    if (!banner) return;

    banner.textContent = message;
    banner.removeAttribute('hidden');

    // Clear any existing timer to avoid multiple concurrent timers
    if (this._errorBannerTimer != null) {
      clearTimeout(this._errorBannerTimer);
    }

    this._errorBannerTimer = setTimeout(() => {
      this.hideErrorBanner();
      this._errorBannerTimer = null;
    }, 5000);
  },

  /**
   * Adds the hidden attribute back to #error-banner.
   */
  hideErrorBanner() {
    const banner = document.getElementById('error-banner');
    if (banner) {
      banner.setAttribute('hidden', '');
    }
  },

  /** @type {number|null} */
  _errorBannerTimer: null,
};

// ---------------------------------------------------------------------------
// _escapeHtml
// Utility: escapes HTML special characters to prevent XSS when injecting
// user-supplied strings into innerHTML.
// ---------------------------------------------------------------------------
function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// ListController
// Handles delete button clicks via event delegation on #transaction-list.
// Wires TransactionStore → StorageService → UIRenderer.
// ---------------------------------------------------------------------------
const ListController = {
  /**
   * Attaches a delegated click event listener to #transaction-list.
   * When a <button> element with a data-id attribute is clicked, the
   * corresponding transaction is deleted from the store, persisted to
   * localStorage, and the UI is re-rendered.
   */
  init() {
    const list = document.getElementById('transaction-list');
    if (!list) return;

    list.addEventListener('click', (event) => {
      const target = event.target;

      // Only handle clicks on <button> elements that carry a data-id attribute
      if (target.tagName !== 'BUTTON' || !target.hasAttribute('data-id')) {
        return;
      }

      const id = target.getAttribute('data-id');

      // Remove the transaction from the in-memory store
      TransactionStore.delete(id);

      // Persist the updated list; surface any storage failure via the error banner
      try {
        StorageService.save(TransactionStore.getAll());
      } catch (err) {
        if (err instanceof StorageError) {
          UIRenderer.showErrorBanner(err.message);
        } else {
          UIRenderer.showErrorBanner(
            err && err.message ? err.message : 'An unexpected error occurred while saving.'
          );
        }
      }

      // Re-render all UI regions
      UIRenderer.render(TransactionStore.getAll());
    });
  },
};

// ---------------------------------------------------------------------------
// FormController
// Handles form submit event, wires Validator → TransactionStore → UIRenderer.
// ---------------------------------------------------------------------------
const FormController = {
  /**
   * Attaches a submit event listener to #transaction-form.
   * On submit:
   *   1. Prevents default form submission.
   *   2. Reads values from #item-name, #item-amount, #item-category.
   *   3. Validates via Validator.validate().
   *   4. On failure: shows form errors and returns early.
   *   5. On success: clears errors, adds transaction to store, persists to
   *      localStorage (showing error banner on StorageError), re-renders UI,
   *      and resets the form fields.
   */
  init() {
    const form = document.getElementById('transaction-form');
    if (!form) return;

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const nameEl     = document.getElementById('item-name');
      const amountEl   = document.getElementById('item-amount');
      const categoryEl = document.getElementById('item-category');

      const name     = nameEl     ? nameEl.value     : '';
      const amount   = amountEl   ? amountEl.value   : '';
      const category = categoryEl ? categoryEl.value : '';

      const result = Validator.validate(name, amount, category);

      if (result.valid === false) {
        UIRenderer.showFormErrors(result.errors);
        return;
      }

      // Validation passed — clear any previous errors
      UIRenderer.clearFormErrors();

      // Add the transaction to the in-memory store
      TransactionStore.add({
        name: name.trim(),
        amount: parseFloat(amount),
        category,
      });

      // Persist to localStorage; surface any storage failure via the error banner
      try {
        StorageService.save(TransactionStore.getAll());
      } catch (err) {
        if (err instanceof StorageError) {
          UIRenderer.showErrorBanner(err.message);
        } else {
          UIRenderer.showErrorBanner(
            err && err.message ? err.message : 'An unexpected error occurred while saving.'
          );
        }
      }

      // Re-render all UI regions
      UIRenderer.render(TransactionStore.getAll());

      // Reset form fields
      if (nameEl)     nameEl.value     = '';
      if (amountEl)   amountEl.value   = '';
      if (categoryEl) categoryEl.value = 'Food';
    });
  },
};

// ---------------------------------------------------------------------------
// SortController
// Listens for sort dropdown changes and re-renders the UI.
// ---------------------------------------------------------------------------
const SortController = {
  init() {
    const select = document.getElementById('sort-select');
    if (!select) return;

    select.addEventListener('change', (event) => {
      SortService.currentSort = event.target.value;
      UIRenderer.render(TransactionStore.getAll());
    });
  },
};

// ---------------------------------------------------------------------------
// ThemeController
// Toggle light/dark mode and persist preference in localStorage.
// ---------------------------------------------------------------------------
const ThemeController = {
  _key: 'ebv_theme',

  init() {
    const button = document.getElementById('theme-toggle');
    if (!button) return;

    // Load saved theme on startup
    const savedTheme = localStorage.getItem(this._key);
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
      button.textContent = '☀️';
    }

    // Toggle on click
    button.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-mode');
      button.textContent = isDark ? '☀️' : '🌙';
      localStorage.setItem(this._key, isDark ? 'dark' : 'light');
      UIRenderer.render(TransactionStore.getAll());
    });
  },
};

// ---------------------------------------------------------------------------
// Application Initialisation
// Runs on DOMContentLoaded:
//   1. Load persisted transactions from localStorage (or show error banner on failure)
//   2. Populate the TransactionStore
//   3. Render the initial UI (balance, list, chart)
//   4. Wire up FormController and ListController
// ---------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    let initial = [];

    try {
      initial = StorageService.load();
    } catch (err) {
      if (err instanceof StorageError) {
        UIRenderer.showErrorBanner(err.message);
      } else {
        UIRenderer.showErrorBanner(
          err && err.message ? err.message : 'Failed to load saved transactions.'
        );
      }
      initial = [];
    }

    TransactionStore.load(initial);
    UIRenderer.render(TransactionStore.getAll());

    FormController.init();
    ListController.init();
    SortController.init();
    ThemeController.init();
  });
