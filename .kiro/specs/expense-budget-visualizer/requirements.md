# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track personal expenses, categorize spending, and visualize their budget distribution through an interactive pie chart. The application runs entirely in the browser using HTML, CSS, and Vanilla JavaScript, with all data persisted via the browser's LocalStorage API. No backend server or complex setup is required.

## Glossary

- **Application**: The Expense & Budget Visualizer web application running in the browser.
- **Transaction**: A single expense entry consisting of an item name, a monetary amount, and a category.
- **Transaction_List**: The scrollable UI component that displays all recorded transactions.
- **Input_Form**: The UI form component used to enter and submit new transactions.
- **Category**: A classification label for a transaction. Valid values are: Food, Transport, Fun.
- **Total_Balance**: The computed sum of all transaction amounts displayed at the top of the Application.
- **Pie_Chart**: The visual chart component that displays spending distribution broken down by Category.
- **LocalStorage**: The browser's built-in client-side key-value storage API used to persist transaction data.
- **Validator**: The client-side logic component responsible for validating Input_Form field values before submission.

---

## Requirements

### Requirement 1: Add a Transaction via Input Form

**User Story:** As a user, I want to fill in an input form with an item name, amount, and category, so that I can record a new expense transaction.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a text field for the item name (maximum 100 characters), a numeric field for the amount, and a dropdown selector for the Category.
2. THE Input_Form SHALL offer exactly three Category options: Food, Transport, and Fun.
3. WHEN the user submits the Input_Form with all fields filled and a valid positive amount, THE Application SHALL add the Transaction to the top of the Transaction_List.
4. WHEN the user submits the Input_Form with all fields filled and a valid positive amount, THE Application SHALL persist the Transaction to LocalStorage.
5. WHEN the user submits the Input_Form with all fields filled and a valid positive amount, THE Input_Form SHALL reset the item name and amount fields to empty and reset the Category dropdown to its first option (Food).
6. IF the user submits the Input_Form with one or more empty fields, THEN THE Validator SHALL display an inline error message indicating which fields are missing.
7. IF the user submits the Input_Form with an amount that is not a number between 0.01 and 999,999,999.99 inclusive, THEN THE Validator SHALL display an inline error message stating that the amount must be a positive number.

---

### Requirement 2: View Transaction List

**User Story:** As a user, I want to see a scrollable list of all my recorded transactions, so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display all persisted transactions, each showing the item name, amount formatted as a currency value with two decimal places, and Category.
2. THE Transaction_List SHALL be scrollable when the number of transactions causes the list height to exceed its visible container area.
3. WHEN the Application loads in the browser, THE Transaction_List SHALL populate with all transactions previously saved in LocalStorage, displayed in the order they were added (most recent first).
4. WHILE no transactions exist, THE Transaction_List SHALL display a placeholder message indicating there are no transactions yet.

---

### Requirement 3: Delete a Transaction

**User Story:** As a user, I want to delete a transaction from the list, so that I can remove incorrect or unwanted entries.

#### Acceptance Criteria

1. THE Transaction_List SHALL display a visible, activatable delete button for each transaction entry.
2. WHEN the user activates the delete button for a transaction, THE Application SHALL remove that transaction from the Transaction_List immediately.
3. WHEN the user activates the delete button for a transaction, THE Application SHALL remove that transaction from LocalStorage and write the updated transaction dataset back to LocalStorage.
4. IF the LocalStorage write fails when deleting a transaction, THEN THE Application SHALL display an error message indicating the deletion could not be saved, and the transaction SHALL remain removed from the Transaction_List for the current session.

---

### Requirement 4: Display and Update Total Balance

**User Story:** As a user, I want to see the total balance of all my expenses at the top of the page, so that I can quickly understand my overall spending.

#### Acceptance Criteria

1. THE Application SHALL display the Total_Balance at the top of the page, formatted as a currency value with two decimal places.
2. WHEN a Transaction is added, THE Application SHALL recalculate and update the Total_Balance without requiring a page reload.
3. WHEN a Transaction is deleted, THE Application SHALL recalculate and update the Total_Balance without requiring a page reload.
4. WHEN the Application loads, THE Application SHALL calculate the Total_Balance from all transactions stored in LocalStorage and display it immediately.
5. WHILE no transactions exist, THE Application SHALL display a Total_Balance of $0.00.

---

### Requirement 5: Visualize Spending with a Pie Chart

**User Story:** As a user, I want to see a pie chart of my spending by category, so that I can understand how my budget is distributed across Food, Transport, and Fun.

#### Acceptance Criteria

1. THE Pie_Chart SHALL display spending distribution segmented by Category, with one segment per Category that has at least one transaction, where each segment's size is proportional to the sum of transaction amounts for that category relative to the total of all displayed amounts.
2. WHEN a Transaction is added, THE Pie_Chart SHALL update automatically within 100ms to reflect the new spending distribution without requiring a page reload.
3. WHEN a Transaction is deleted, THE Pie_Chart SHALL update automatically within 100ms to reflect the revised spending distribution without requiring a page reload.
4. WHEN the Application loads with existing transactions in LocalStorage, THE Pie_Chart SHALL render the correct spending distribution immediately.
5. WHILE no transactions exist, THE Pie_Chart SHALL display a placeholder message indicating there is no spending data to display.
6. WHILE transactions exist but none belong to the categories Food, Transport, or Fun, THE Pie_Chart SHALL display a placeholder message indicating no trackable spending data is available.
7. THE Pie_Chart SHALL display the category name and its percentage of total spending (rounded to the nearest whole number) for each segment.

---

### Requirement 6: Persist Data Across Sessions

**User Story:** As a user, I want my transactions to be saved between browser sessions, so that I do not lose my expense history when I close and reopen the browser.

#### Acceptance Criteria

1. WHEN a Transaction is added, THE Application SHALL write the updated transaction dataset to LocalStorage before the add operation is considered complete.
2. WHEN a Transaction is deleted, THE Application SHALL write the updated transaction dataset to LocalStorage before the delete operation is considered complete.
3. WHEN the Application loads, THE Application SHALL read all transactions from LocalStorage and restore the full application state, including the Transaction_List, Total_Balance, and Pie_Chart.
4. IF LocalStorage data cannot be parsed as a valid transaction array during Application load, THEN THE Application SHALL display an error message indicating that data could not be loaded and initialize with a default empty state rather than silently failing.
5. IF a LocalStorage write operation fails when adding or deleting a transaction, THEN THE Application SHALL display an error message indicating the change could not be saved persistently.

---

### Requirement 7: Responsive and Performant UI

**User Story:** As a user, I want the application to load quickly and respond without noticeable lag, so that I can use it efficiently on any modern browser.

#### Acceptance Criteria

1. THE Application SHALL load and render the initial UI within 3 seconds on a standard broadband connection in the last 2 major released versions of Chrome, Firefox, Edge, and Safari.
2. WHEN the user interacts with the Input_Form, Transaction_List, or Pie_Chart, THE Application SHALL reflect the change in the UI within 100ms of the triggering input event firing.
3. THE Application SHALL consist of exactly one HTML file, one CSS file inside a `css/` directory, and one JavaScript file inside a `js/` directory.
