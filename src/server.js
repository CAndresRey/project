const express = require('express');
const cors = require('cors');
const { convertToMSSQL } = require('./sqlConverter');
const { executeQuery, initDatabase } = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize database when server starts
initDatabase().catch(console.error);

// Convert MySQL to MSSQL
app.post('/api/convert', (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const convertedQuery = convertToMSSQL(query);
    res.json({ convertedQuery });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Execute converted query
app.post('/api/execute', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const result = await executeQuery(query);
    res.json({ result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});

module.exports = app;