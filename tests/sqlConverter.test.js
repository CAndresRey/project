const { convertToMSSQL } = require('../src/sqlConverter');

describe('SQL Converter Tests', () => {
  test('converts CREATE TABLE with various data types', () => {
    const mysql = `CREATE TABLE users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      status ENUM('active','inactive'),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;
    
    const result = convertToMSSQL(mysql);
    expect(result).toMatch(/IDENTITY\(1,1\)/i);
    expect(result).toMatch(/VARCHAR\(255\)/i);
    expect(result).toMatch(/VARCHAR\(255\)/i);
    expect(result).toMatch(/DATETIME2/i);
    expect(result).toMatch(/DEFAULT GETDATE\(\)/i);
  });

  test('converts complex SELECT with JOIN and functions', () => {
    const mysql = `SELECT 
      u.name, 
      CONCAT(u.first_name, ' ', u.last_name) as full_name,
      COUNT(*) as count
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    WHERE YEAR(o.created_at) = 2023
    GROUP BY u.id
    HAVING count > 0
    LIMIT 10 OFFSET 20`;

    const result = convertToMSSQL(mysql);
    expect(result).toMatch(/first_name \+ ' ' \+ last_name/i);
    expect(result).toMatch(/DATEPART\(YEAR/i);
    expect(result).toMatch(/OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY/i);
  });

  test('converts INSERT IGNORE to MERGE', () => {
    const mysql = `INSERT IGNORE INTO users (id, name) VALUES (1, 'test')`;
    const result = convertToMSSQL(mysql);
    expect(result).toMatch(/MERGE INTO.*WITH \(HOLDLOCK\)/i);
    expect(result).toMatch(/WHEN NOT MATCHED/i);
  });

  test('handles errors gracefully', () => {
    expect(() => convertToMSSQL('')).toThrow('Empty query provided');
    expect(() => convertToMSSQL('INVALID SQL')).not.toThrow();
  });
});
