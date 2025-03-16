// These imports are needed for future expansion of the analyzer config loading
import { cosmiconfig } from 'cosmiconfig';
import logger from './logger';

export interface AnalyzerConfig {
  ignorePatterns: string[];
  severityLevels: {
    unusedExport: string;
    unusedImport: string;
    unusedDeclaration: string;
    redundantCode: string;
    deadCode: string;
  };
  maxFileSize: number;
  cacheEnabled: boolean;
  cacheLocation: string;
  reportFormat: string;
  workspaces: string[];
  excludeFromCoverage: string[];
}

export const defaultConfig: AnalyzerConfig = {
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

export async function loadConfig(): Promise<AnalyzerConfig> {
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