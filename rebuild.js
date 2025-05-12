/**
 * Build helper script
 * 
 * This script helps rebuild the application with optimizations to fix:
 * 1. The "Cannot access 'E' before initialization" error (TDZ issue)
 * 2. The "codes.forEach is not a function" error in LanguageUtil
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('===== Build Helper Script =====');

// Check if the required fixes are in place
const checkFiles = () => {
  const requiredFiles = [
    'src/utils/LanguageUtil.js',
    'src/utils/i18n.js'
  ];
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(path.resolve(__dirname, file))) {
      console.error(`Error: Required file ${file} is missing!`);
      return false;
    }
  }
  
  return true;
};

// Ensure all fixes are in place
if (!checkFiles()) {
  process.exit(1);
}

try {
  // Clean node_modules/.cache to ensure clean build
  console.log('Cleaning build cache...');
  if (fs.existsSync(path.resolve(__dirname, 'node_modules/.cache'))) {
    fs.rmSync(path.resolve(__dirname, 'node_modules/.cache'), { recursive: true, force: true });
  }
  
  // Run build
  console.log('Building application...');
  execSync('npm run build', { stdio: 'inherit' });
  
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
} 