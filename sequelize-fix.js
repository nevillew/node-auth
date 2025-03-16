/**
 * Updates Sequelize imports in model files
 */
const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'src', 'models');
const utilsDir = path.join(__dirname, 'src', 'utils');
const servicesDir = path.join(__dirname, 'src', 'services');
const configDir = path.join(__dirname, 'src', 'config');

// Import pattern to match
const importPattern = /import\s+{\s*(?:[^{}]*,\s*)?(Sequelize)(?:\s*,\s*[^{}]*)?\s*}\s+from\s+['"]sequelize['"];/;

// New import pattern
const newImport = `import SequelizeOriginal from 'sequelize';
const { Sequelize } = SequelizeOriginal as any;`;

function processFile(filePath) {
  // Skip index.ts as we've already fixed it manually
  if (filePath.endsWith('index.ts') || filePath.endsWith('entity.ts') || filePath.endsWith('modelFactory.ts')) {
    console.log(`Skipping ${filePath} (already processed)`);
    return;
  }

  // Read the file
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`Error reading file ${filePath}: ${err}`);
    return;
  }

  // Check if the file imports Sequelize
  if (importPattern.test(content)) {
    console.log(`Processing ${filePath}...`);
    
    // Create the replacement based on the current import
    const match = content.match(importPattern);
    const importStatement = match[0];
    const importParts = importStatement.replace(/import\s+{\s*/, '')
      .replace(/\s*}\s+from\s+['"]sequelize['"];/, '')
      .split(',')
      .map(s => s.trim())
      .filter(s => s !== 'Sequelize');
    
    // Create the new imports
    let replacement = newImport;
    if (importParts.length > 0) {
      replacement += `\nimport { ${importParts.join(', ')} } from 'sequelize';`;
    }
    
    // Replace the import
    const updatedContent = content.replace(importPattern, replacement);
    
    // Write the updated content back to the file
    try {
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      console.log(`Updated ${filePath}`);
    } catch (err) {
      console.error(`Error writing to file ${filePath}: ${err}`);
    }
  }
}

// Process all .ts files in the directories
function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      processDirectory(filePath);
    } else if (file.endsWith('.ts')) {
      processFile(filePath);
    }
  }
}

// Process all directories
processDirectory(modelsDir);
processDirectory(utilsDir);
processDirectory(servicesDir);
processDirectory(configDir);

console.log('Finished updating Sequelize imports');