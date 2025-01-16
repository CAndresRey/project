const axios = require('axios');

async function demonstrateConversion() {
  // Example MySQL queries with various edge cases
  const queries = [
    // Complex CREATE TABLE query
    `CREATE TABLE products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description LONGTEXT,
      price DECIMAL(10,2) UNSIGNED,
      category ENUM('Electronics', 'Books', 'Clothing'),
      tags SET('new', 'sale', 'featured'),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      stock_status TINYINT(1) DEFAULT 1,
      metadata JSON
    )`,
    
    // Insert with multiple data types
    `INSERT INTO products (name, description, price, category, created_at) VALUES
     ('Laptop Pro', 'High-end laptop', 1299.99, 'Electronics', NOW()),
     ('Smart Watch', 'Fitness tracker', 199.99, 'Electronics', CURRENT_TIMESTAMP())`,
     
    // Complex SELECT with JOIN and functions
    `SELECT p.name, 
            CONCAT(p.category, ': ', p.name) as full_name,
            IFNULL(p.description, 'No description') as safe_description,
            COUNT(*) as product_count
     FROM products p
     LEFT JOIN categories c USING (category_id)
     WHERE p.price > 100
     GROUP BY p.category
     HAVING product_count > 0
     LIMIT 10 OFFSET 20`,
     
    // Query that should fail (non-existent table)
    `SELECT * FROM nonexistent_table`,
    
    // Query with non-existent column
    `SELECT invalid_column FROM products`,
    
    // ON DUPLICATE KEY UPDATE example with simpler syntax
    `INSERT INTO products (id, name, price) 
     VALUES (1, 'Updated Laptop', 1399.99)`,
    
    // Test UPSERT with existing record
    `INSERT INTO products (id, name, price) 
     VALUES (1, 'Updated Laptop Pro', 1499.99)`,
     
    // Complex UPDATE with CASE
    `UPDATE products 
     SET status = CASE 
       WHEN price < 100 THEN 'budget'
       WHEN price < 1000 THEN 'medium'
       ELSE 'premium'
     END
     WHERE category = 'Electronics'`
  ];

  const API_URL = 'http://localhost:3000';
  
  try {
    console.log('🚀 Starting Enhanced SQL Converter Demo\n');

    for (const mysqlQuery of queries) {
      console.log('📝 Original MySQL Query:');
      console.log(mysqlQuery);
      console.log();

      try {
        // Step 1: Convert the query
        console.log('Sending conversion request...');
        const convertResponse = await axios.post(`${API_URL}/api/convert`, {
          query: mysqlQuery
        });
        
        const convertedQuery = convertResponse.data.convertedQuery;
        console.log('🔄 Converted to SQLite:');
        console.log(convertedQuery);
        console.log();

        // Step 2: Execute the converted query
        console.log('Executing converted query...');
        const executeResponse = await axios.post(`${API_URL}/api/execute`, {
          query: convertedQuery
        });
        
        console.log('✨ Query Result:');
        console.log(JSON.stringify(executeResponse.data.result, null, 2));
      } catch (error) {
        console.log('❌ Query Error:', error.response?.data?.error || error.message);
      }
      
      console.log('\n-------------------\n');
    }

    // Final test: Show all data
    console.log('📊 Final Data Check:');
    const finalQuery = 'SELECT * FROM products ORDER BY price DESC';
    
    try {
      const finalResult = await axios.post(`${API_URL}/api/execute`, {
        query: finalQuery
      });
      
      console.log('\n📋 All Products:');
      console.log(JSON.stringify(finalResult.data.result, null, 2));
    } catch (error) {
      console.log('❌ Final Query Error:', error.response?.data?.error || error.message);
    }

  } catch (error) {
    console.error('❌ Fatal Error:', error.response?.data?.error || error.message);
  }
}

// Run the demonstration
demonstrateConversion().catch(console.error);