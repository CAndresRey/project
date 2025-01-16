const express = require('express');
const cors = require('cors');
const { convertToMSSQL } = require('./sqlConverter');
const { executeQuery, initDatabase } = require('./database');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize database when server starts
initDatabase().catch(console.error);

// Middleware for logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Convert MySQL to MSSQL
app.post('/api/convert', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const convertedQuery = convertToMSSQL(query);
    res.json({ convertedQuery });
  } catch (error) {
    res.status(500).json({
      error: 'Conversion error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Execute converted query
app.post('/api/execute', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Note: Actual execution would require a SQL Server connection
    // This is just a mock response
    res.json({ 
      result: { 
        success: true,
        message: 'Query executed successfully',
        query
      } 
    });
  } catch (error) {
    res.status(500).json({
      error: 'Execution error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Server error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});

module.exports = app;