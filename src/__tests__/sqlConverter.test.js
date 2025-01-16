const { convertToMSSQL } = require('../sqlConverter');
const request = require('supertest');
const app = require('../server');
const { initDatabase, executeQuery } = require('../database');

describe('SQL Converter', () => {
  test('converts AUTO_INCREMENT to IDENTITY', () => {
    const mysql = 'CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY)';
    const expected = 'CREATE TABLE users (id INT IDENTITY(1,1) PRIMARY KEY)';
    expect(convertToMSSQL(mysql)).toBe(expected);
  });

  test('converts backticks to square brackets', () => {
    const mysql = 'SELECT * FROM `users` WHERE `name` = "John"';
    const expected = 'SELECT * FROM [users] WHERE [name] = "John"';
    expect(convertToMSSQL(mysql)).toBe(expected);
  });

  test('converts LIMIT to TOP', () => {
    const mysql = 'SELECT * FROM users LIMIT 10';
    const expected = 'SELECT TOP 10 * FROM users';
    expect(convertToMSSQL(mysql)).toBe(expected);
  });
});

describe('API Endpoints', () => {
  beforeAll(async () => {
    await initDatabase();
    
    // Create test table
    await executeQuery(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT,
        email TEXT
      )
    `);
    
    // Insert test data
    await executeQuery(`
      INSERT INTO users (name, email) VALUES
      ('John Doe', 'john@example.com'),
      ('Jane Smith', 'jane@example.com')
    `);
  });

  test('POST /api/convert returns converted query', async () => {
    const response = await request(app)
      .post('/api/convert')
      .send({ query: 'SELECT * FROM `users` LIMIT 1' });
    
    expect(response.status).toBe(200);
    expect(response.body.convertedQuery).toBe('SELECT TOP 1 * FROM [users]');
  });

  test('POST /api/execute returns query results', async () => {
    const response = await request(app)
      .post('/api/execute')
      .send({ query: 'SELECT * FROM users' });
    
    expect(response.status).toBe(200);
    expect(response.body.result).toHaveLength(2);
    expect(response.body.result[0]).toHaveProperty('name', 'John Doe');
  });

  test('POST /api/execute handles table not found error', async () => {
    const response = await request(app)
      .post('/api/execute')
      .send({ query: 'SELECT * FROM nonexistent_table' });
    
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });
});