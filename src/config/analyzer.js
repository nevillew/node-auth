const path = require('path');
const fs = require('fs').promises;
const yaml = require('js-yaml');
const { cosmiconfig } = require('cosmiconfig');

const defaultConfig = {
  ignorePatterns: [
    '**/*.test.{js,ts,jsx,tsx}',
    '**/*.spec.{js,ts,jsx,tsx}',
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**'
  ],
  severityLevels: {
    unusedExport: 'warning',
    unusedImport: 'warning',
    unusedDeclaration: 'error',
    redundantCode: 'error',
    deadCode: 'warning'
  },
  maxFileSize: 1024 * 1024, // 1MB
  cacheEnabled: true,
  cacheLocation: '.analyzer-cache',
  reportFormat: 'detailed', // or 'summary'
  workspaces: [],
  excludeFromCoverage: [
    '**/test/**',
    '**/tests/**',
    '**/__tests__/**'
  ]
};

async function loadConfig() {
  try {
    const explorer = cosmiconfig('analyzer');
    const result = await explorer.search();

    if (result) {
      return {
        ...defaultConfig,
        ...result.config
      };
    }

    return defaultConfig;
  } catch (error) {
    logger.warn('Failed to load config, using defaults:', error);
    return defaultConfig;
  }
}

module.exports = {
  loadConfig,
  defaultConfig
};
