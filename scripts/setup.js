const fs = require('fs');
const path = require('path');

// Create necessary directories
const dirs = [
  'src',
  'tests',
  'logs',
  'scripts'
];

dirs.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Create .env file if it doesn't exist
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  const envContent = `PORT=3000
NODE_ENV=development
LOG_LEVEL=debug`;
  
  fs.writeFileSync(envPath, envContent);
  console.log('Created .env file');
}

console.log('Setup complete!');
