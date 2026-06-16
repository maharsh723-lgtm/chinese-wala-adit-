const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// CORS Headers Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

app.use(express.static(__dirname));

// API: Get Consolidated State
app.get('/api/state', (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    // 1. Employees
    const empRows = db.prepare('SELECT * FROM employees').all();
    const employees = {};
    for (const row of empRows) {
      employees[row.id] = {
        id: row.id,
        name: row.name,
        role: row.role,
        mobile: row.mobile,
        shiftStart: row.shiftStart,
        roleKey: row.roleKey,
        password: row.password,
        status: row.status,
        store: row.store,
        activePunch: row.activePunch ? JSON.parse(row.activePunch) : null,
        history: row.history ? JSON.parse(row.history) : []
      };
    }

    // 2. Leave Requests
    const leaveRequests = db.prepare('SELECT * FROM leave_requests').all();

    // 3. Purchase Requests
    const prRows = db.prepare('SELECT * FROM purchase_requests').all();
    const purchaseRequests = prRows.map(row => ({
      id: row.id,
      name: row.name,
      qty: row.qty,
      supplier: row.supplier,
      store: row.store,
      reqDate: row.reqDate,
      status: row.status,
      currentStep: row.currentStep,
      history: row.history ? JSON.parse(row.history) : []
    }));

    // 4. SOPs
    const sops = db.prepare('SELECT * FROM sops').all();

    // 5. Inventory
    const inventory = db.prepare('SELECT * FROM inventory').all();

    // 6. Wastage
    const wastage = db.prepare('SELECT * FROM wastage').all();

    // 7. Checklists
    const checklistRows = db.prepare('SELECT * FROM checklists').all();
    const checklists = checklistRows.map(row => ({
      id: row.id,
      type: row.type,
      store: row.store,
      date: row.date,
      progress: row.progress,
      completed: row.completed,
      items: row.items ? JSON.parse(row.items) : []
    }));

    // 8. EOD Reports
    const eodReports = db.prepare('SELECT * FROM eod_reports').all();

    // 9. Recipes
    const recipesRaw = db.prepare('SELECT * FROM recipes').all();
    const recipes = recipesRaw.map(row => ({
      id: row.id,
      name: row.name,
      portion: row.portion,
      status: row.status,
      ingredients: row.ingredients ? JSON.parse(row.ingredients) : [],
      rawCost: row.rawCost,
      retailPrice: row.retailPrice
    }));

    res.json({
      employees,
      leaveRequests,
      purchaseRequests,
      sops,
      inventory,
      wastage,
      checklists,
      eodReports,
      recipes
    });
  } catch (err) {
    console.error('Error fetching state:', err);
    res.status(500).json({ error: err.message });
  }
});


// API: Employees
app.post('/api/employees', (req, res) => {
  try {
    const { id, name, mobile, role, shiftStart, roleKey, password, status, store, activePunch, history } = req.body;
    
    // Check mobile uniqueness
    const checkMobile = db.prepare('SELECT COUNT(*) as count FROM employees WHERE mobile = ?').get(mobile);
    if (checkMobile.count > 0) {
      return res.status(400).json({ error: 'This mobile number is already registered.' });
    }

    db.prepare(`
      INSERT INTO employees (id, name, role, mobile, shiftStart, roleKey, password, status, store, activePunch, history)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      role,
      mobile,
      shiftStart,
      roleKey,
      password || '',
      status || 'Active',
      store || 'Mumbai Bandra',
      activePunch ? JSON.stringify(activePunch) : null,
      JSON.stringify(history || [])
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error creating employee:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/employees/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (status === 'Deactivated') {
      db.prepare('UPDATE employees SET status = ?, activePunch = NULL WHERE id = ?').run(status, id);
    } else {
      db.prepare('UPDATE employees SET status = ? WHERE id = ?').run(status, id);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating employee status:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/employees/:id/reset-password', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('UPDATE employees SET password = "" WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees/punch-in', (req, res) => {
  try {
    const { empId, activePunch } = req.body;
    db.prepare('UPDATE employees SET activePunch = ? WHERE id = ?').run(JSON.stringify(activePunch), empId);
    res.json({ success: true });
  } catch (err) {
    console.error('Error logging punch-in:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees/punch-out', (req, res) => {
  try {
    const { empId, history } = req.body;
    db.prepare('UPDATE employees SET activePunch = NULL, history = ? WHERE id = ?').run(JSON.stringify(history), empId);
    res.json({ success: true });
  } catch (err) {
    console.error('Error logging punch-out:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees/:id/attendance-log', (req, res) => {
  try {
    const { id } = req.params;
    const { date, punchIn, punchOut, hours, status, device, location } = req.body;
    
    const row = db.prepare('SELECT history FROM employees WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    const history = row.history ? JSON.parse(row.history) : [];
    
    history.unshift({
      date,
      punchIn,
      punchOut,
      hours: hours.toString(),
      status: status || 'Normal',
      device: device || 'Manual Entry',
      location: location || 'Branch Store'
    });
    
    db.prepare('UPDATE employees SET history = ? WHERE id = ?').run(JSON.stringify(history), id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error logging manual shift:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Leave Requests
app.post('/api/leave-requests', (req, res) => {
  try {
    const { id, empId, name, store, date, reason, status } = req.body;
    db.prepare(`
      INSERT INTO leave_requests (id, empId, name, store, date, reason, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, empId, name, store, date, reason, status || 'PENDING');
    res.json({ success: true });
  } catch (err) {
    console.error('Error creating leave request:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/leave-requests/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    db.prepare('UPDATE leave_requests SET status = ? WHERE id = ?').run(status, id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating leave status:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Purchase Requests
app.post('/api/purchase-requests', (req, res) => {
  try {
    const { id, name, qty, supplier, store, reqDate, status, currentStep, history } = req.body;
    db.prepare(`
      INSERT INTO purchase_requests (id, name, qty, supplier, store, reqDate, status, currentStep, history)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, qty, supplier, store, reqDate, status, currentStep, JSON.stringify(history || []));
    res.json({ success: true });
  } catch (err) {
    console.error('Error creating purchase request:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/purchase-requests/:id/approve', (req, res) => {
  try {
    const { id } = req.params;
    const { status, currentStep, history } = req.body;
    db.prepare(`
      UPDATE purchase_requests
      SET status = ?, currentStep = ?, history = ?
      WHERE id = ?
    `).run(status, currentStep, JSON.stringify(history), id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error approving PR:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/purchase-requests/:id/reject', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("UPDATE purchase_requests SET status = 'rejected' WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error rejecting PR:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: SOPs
app.post('/api/sops', (req, res) => {
  try {
    const { id, title, dept, priority, freq, instructions, assignedTo, store, status, completionPct, dueDate } = req.body;
    db.prepare(`
      INSERT INTO sops (id, title, dept, priority, freq, instructions, assignedTo, store, status, completionPct, dueDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, dept, priority, freq, instructions, assignedTo, store, status, completionPct, dueDate);
    res.json({ success: true });
  } catch (err) {
    console.error('Error creating SOP:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/sops/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status, completionPct } = req.body;
    db.prepare('UPDATE sops SET status = ?, completionPct = ? WHERE id = ?').run(status, completionPct, id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating SOP status:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Inventory
app.post('/api/inventory', (req, res) => {
  try {
    const { id, label, category, stock, unit, reorder, unitCost, expiryDate, store, status } = req.body;
    db.prepare(`
      INSERT INTO inventory (id, label, category, stock, unit, reorder, unitCost, expiryDate, store, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, label, category, stock, unit, reorder, unitCost, expiryDate, store, status);
    res.json({ success: true });
  } catch (err) {
    console.error('Error adding inventory:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/inventory/:id/adjust', (req, res) => {
  try {
    const { id } = req.params;
    const { stock, status } = req.body;
    db.prepare('UPDATE inventory SET stock = ?, status = ? WHERE id = ?').run(stock, status, id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error adjusting stock:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/inventory/:id/edit', (req, res) => {
  try {
    const { id } = req.params;
    const { label, category, stock, unit, reorder, unitCost, expiryDate, status } = req.body;
    db.prepare('UPDATE inventory SET label = ?, category = ?, stock = ?, unit = ?, reorder = ?, unitCost = ?, expiryDate = ?, status = ? WHERE id = ?')
      .run(label, category, stock, unit, reorder, unitCost, expiryDate, status, id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error editing inventory:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Wastage
app.post('/api/wastage', (req, res) => {
  try {
    const { id, store, name, qty, unit, reason, date } = req.body;
    db.prepare(`
      INSERT INTO wastage (id, store, name, qty, unit, reason, date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, store, name, qty, unit, reason, date);
    res.json({ success: true });
  } catch (err) {
    console.error('Error recording wastage:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Checklists
app.post('/api/checklists', (req, res) => {
  try {
    const { id, type, store, date, progress, completed, items } = req.body;
    db.prepare(`
      INSERT OR REPLACE INTO checklists (id, type, store, date, progress, completed, items)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, type, store, date, progress, completed, JSON.stringify(items));
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving checklist:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: EOD Reports
app.post('/api/eod-reports', (req, res) => {
  try {
    const { id, store, date, sales, expenses, cash, upi, card, orders, submittedBy, submittedAt } = req.body;
    db.prepare(`
      INSERT OR REPLACE INTO eod_reports (id, store, date, sales, expenses, cash, upi, card, orders, submittedBy, submittedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, store, date, sales, expenses, cash, upi, card, orders, submittedBy, submittedAt);
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving EOD Report:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Recipes
app.post('/api/recipes', (req, res) => {
  try {
    const role = req.headers['x-user-role'];
    if (role !== 'owner') {
      return res.status(403).json({ error: 'Permission denied. Only Franchise Owner can perform this action.' });
    }
    const { id, name, portion, status, ingredients, rawCost, retailPrice } = req.body;
    db.prepare(`
      INSERT OR REPLACE INTO recipes (id, name, portion, status, ingredients, rawCost, retailPrice)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, portion, status, JSON.stringify(ingredients), rawCost, retailPrice);
    res.json({ success: true });
  } catch (err) {
    console.error('Error creating recipe:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/recipes/:id', (req, res) => {
  try {
    const role = req.headers['x-user-role'];
    if (role !== 'owner') {
      return res.status(403).json({ error: 'Permission denied. Only Franchise Owner can perform this action.' });
    }
    const { id } = req.params;
    db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting recipe:', err);
    res.status(500).json({ error: err.message });
  }
});


// Fallback to serve index.html for single page layout
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
