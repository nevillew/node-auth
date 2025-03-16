#!/usr/bin/env node

import { program } from 'commander';
import docAnalyzer from '../utils/docAnalyzer';
import path from 'path';
import glob from 'glob';
import fs from 'fs/promises';
import logger from '../config/logger';
import cliProgress from 'cli-progress';
import colors from 'ansi-colors';
// Analyzer config is imported from config/analyzer

interface Report {
  timestamp: string;
  summary: {
    filesAnalyzed: number;
    totalIssues: number;
  };
  results: any[];
}

program
  .name('analyze-docs')
  .description('Analyze code documentation and suggest improvements')
  .version('1.0.0')
  .option('-p, --path <path>', 'Path to analyze (file or directory)', '.')
  .option('-o, --output <path>', 'Output report file path')
  .parse(process.argv);

const options = program.opts();

async function analyzeFiles(pattern: string): Promise<void> {
  const files = glob.sync(pattern);
  const results: any[] = [];
  
  // Create progress bar
  const progress = new cliProgress.SingleBar({
    format: 'Analyzing |' + colors.cyan('{bar}') + '| {percentage}% | {value}/{total} files',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });

  // Initialize progress bar
  progress.start(files.length, 0);

  for (const file of files) {
    try {
      // Create a progress tracker for the analyzer to call
      const progressTracker = {
        increment: () => progress.increment()
      };
      
      const result = await docAnalyzer.analyzeFile(file, progressTracker);
      if (result) {
        results.push(result);
      
        // Log results
        if (result.issues.length > 0) {
          console.log(`\nDocumentation issues in ${file}:`);
          result.issues.forEach(issue => {
            console.log(`- ${issue.message} (line ${issue.line})`);
          });

          console.log('\nSuggestions:');
          result.suggestions.forEach(s => {
            console.log(`\n${s.suggestion}`);
          });
        }
      }
    } catch (error) {
      logger.error(`Failed to analyze ${file}:`, error);
    }
  }

  // Stop progress bar
  progress.stop();

  // Generate report if output specified
  if (options.output) {
    const report: Report = {
      timestamp: new Date().toISOString(),
      summary: {
        filesAnalyzed: results.length,
        totalIssues: results.reduce((sum, r) => sum + (r.issues?.length || 0), 0)
      },
      results
    };

    await fs.writeFile(options.output, JSON.stringify(report, null, 2));
    console.log(`\nReport written to ${options.output}`);
  }
}

// Main execution
(async () => {
  try {
    const targetPath = path.resolve(options.path);
    const stats = await fs.stat(targetPath);

    if (stats.isDirectory()) {
      await analyzeFiles(path.join(targetPath, '**/*.{js,jsx,ts,tsx}'));
    } else {
      await analyzeFiles(targetPath);
    }
  } catch (error) {
    logger.error('Analysis failed:', error);
    process.exit(1);
  }
})();