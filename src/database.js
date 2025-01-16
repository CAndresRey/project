const initSqlJs = require('sql.js');

let db;

async function initDatabase() {
  const SQL = await initSqlJs();
  db = new SQL.Database();
  
  // Initialize the database with the table structure
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        department TEXT,
        salary REAL
      )
    `);
    
    // Insert initial data if table is empty
    const result = db.exec("SELECT COUNT(*) as count FROM users");
    if (result[0].values[0][0] === 0) {
      db.run(`
        INSERT INTO users (name, department, salary) VALUES
        ('John Doe', 'Engineering', 75000.00),
        ('Jane Smith', 'Marketing', 65000.00),
        ('Bob Wilson', 'Engineering', 70000.00)
      `);
    }
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
  
  return db;
}

async function executeQuery(query) {
  if (!db) {
    await initDatabase();
  }

  try {
    // For SELECT queries
    if (query.trim().toUpperCase().startsWith('SELECT')) {
      const results = [];
      const stmt = db.prepare(query);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    }
    
    // For other queries (INSERT, UPDATE, CREATE, etc.)
    db.run(query);
    return { success: true };
  } catch (error) {
    throw new Error(`Database error: ${error.message}`);
  }
}

module.exports = { executeQuery, initDatabase, db };