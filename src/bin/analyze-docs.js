#!/usr/bin/env node

const { program } = require('commander');
const analyzer = require('../utils/docAnalyzer');
const path = require('path');
const glob = require('glob');
const fs = require('fs').promises;
const logger = require('../config/logger');

program
  .name('analyze-docs')
  .description('Analyze code documentation and suggest improvements')
  .version('1.0.0')
  .option('-p, --path <path>', 'Path to analyze (file or directory)', '.')
  .option('-o, --output <path>', 'Output report file path')
  .parse(process.argv);

const options = program.opts();

async function analyzeFiles(pattern) {
  const files = glob.sync(pattern);
  const results = [];

  for (const file of files) {
    try {
      const result = await analyzer.analyzeFile(file);
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
    } catch (error) {
      logger.error(`Failed to analyze ${file}:`, error);
    }
  }

  // Generate report if output specified
  if (options.output) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        filesAnalyzed: results.length,
        totalIssues: results.reduce((sum, r) => sum + r.issues.length, 0)
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
