const axios = require('axios');

async function demonstrateConversion() {
  // Example MySQL queries with various edge cases
  const queries = [
    // Complex CREATE TABLE with all data types
    `CREATE TABLE users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password_hash BINARY(64),
      profile JSON,
      last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
      status ENUM('active', 'inactive', 'banned'),
      permissions SET('read', 'write', 'admin'),
      location POINT,
      metadata LONGTEXT,
      INDEX idx_username (username),
      FULLTEXT INDEX idx_metadata (metadata)
    ) ENGINE=InnoDB CHARACTER SET utf8mb4`,

    // Complex INSERT with functions
    `INSERT INTO users (username, last_login, status, permissions)
    SELECT 
      CONCAT('user_', FLOOR(RAND() * 1000)),
      DATE_ADD(NOW(), INTERVAL -FLOOR(RAND() * 365) DAY),
      CASE WHEN RAND() > 0.5 THEN 'active' ELSE 'inactive' END,
      CASE WHEN RAND() > 0.7 THEN 'admin,write,read' ELSE 'read,write' END
    FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) t`,

    // Complex SELECT with window functions
    `SELECT 
      u.username,
      ROW_NUMBER() OVER (PARTITION BY status ORDER BY last_login DESC) as login_rank,
      FIRST_VALUE(last_login) OVER (PARTITION BY status ORDER BY last_login) first_login,
      DENSE_RANK() OVER (ORDER BY DATE(last_login)) as login_dense_rank,
      NTILE(4) OVER (ORDER BY last_login) as login_quartile
    FROM users u
    WHERE last_login > DATE_SUB(NOW(), INTERVAL 1 MONTH)`,

    // Complex JOIN with aggregations
    `SELECT 
      YEAR(u.last_login) as year,
      QUARTER(u.last_login) as quarter,
      u.status,
      COUNT(DISTINCT u.id) as user_count,
      GROUP_CONCAT(DISTINCT u.username ORDER BY u.username ASC SEPARATOR ', ') as usernames,
      JSON_ARRAYAGG(u.profile) as profiles
    FROM users u
    LEFT JOIN (
      SELECT id, COUNT(*) as login_count 
      FROM login_history 
      GROUP BY id
    ) h ON u.id = h.id
    GROUP BY YEAR(u.last_login), QUARTER(u.last_login), u.status
    HAVING user_count > 1
    ORDER BY year DESC, quarter DESC`,

    // Complex UPDATE with subquery
    `UPDATE users u
    SET status = 'inactive',
        last_login = NULL
    WHERE u.id IN (
      SELECT id 
      FROM (
        SELECT id
        FROM users
        WHERE last_login < DATE_SUB(NOW(), INTERVAL 1 YEAR)
        AND status != 'banned'
      ) tmp
    )`,

    // Complex DELETE with JOIN
    `DELETE u, h 
    FROM users u
    INNER JOIN login_history h ON u.id = h.user_id
    WHERE u.status = 'banned'
    AND u.last_login < DATE_SUB(NOW(), INTERVAL 1 YEAR)`,

    // Test error handling - Invalid syntax
    `SELECT * FROM users WHERE;`,

    // Test error handling - Invalid function
    `SELECT INVALID_FUNCTION() FROM users`
  ];

  const API_URL = 'http://localhost:3000';
  
  try {
    console.log('🚀 Starting Enhanced SQL Converter Demo\n');

    for (const [index, mysqlQuery] of queries.entries()) {
      console.log(`\n📝 Test Case ${index + 1}:`);
      console.log('Original MySQL Query:');
      console.log(mysqlQuery);
      console.log();

      try {
        console.log('Converting...');
        const convertResponse = await axios.post(`${API_URL}/api/convert`, {
          query: mysqlQuery
        });
        
        const convertedQuery = convertResponse.data.convertedQuery;
        console.log('🔄 Converted to SQL Server:');
        console.log(convertedQuery);
        console.log();

        console.log('Executing...');
        const executeResponse = await axios.post(`${API_URL}/api/execute`, {
          query: convertedQuery
        });
        
        console.log('✨ Result:');
        console.log(JSON.stringify(executeResponse.data.result, null, 2));
      } catch (error) {
        console.log('❌ Error:', error.response?.data?.error || error.message);
        console.log('Stack:', error.response?.data?.stack || '');
      }
      
      console.log('\n' + '='.repeat(80) + '\n');
    }

    // Summary
    console.log('📊 Conversion Summary:');
    console.log(`Total queries tested: ${queries.length}`);
    
  } catch (error) {
    console.error('❌ Fatal Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run with proper error handling
demonstrateConversion().catch(error => {
  console.error('💥 Unhandled Error:', error);
  process.exit(1);
});