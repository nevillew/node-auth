import fs from 'fs/promises';
// import path from 'path'; // Will be used with the extname function below
import logger from '../config/logger';
import { cacheManager } from '../services/cacheManager';

interface Issue {
  type: string;
  name: string;
  line: number;
  message: string;
}

interface Suggestion {
  issue: Issue;
  suggestion: string;
}

interface AnalysisResult {
  path: string;
  issues: Issue[];
  suggestions: Suggestion[];
}

interface ProgressTracker {
  increment: () => void;
}

/**
 * Analyzes code documentation and suggests improvements
 * @class DocAnalyzer 
 */
class DocAnalyzer {
  private jsdocTags: string[];
  private config: {
    ignorePatterns: RegExp[];
    maxFileSize: number;
  };

  constructor() {
    this.jsdocTags = ['@param', '@returns', '@throws', '@example', '@description'];
    this.config = {
      ignorePatterns: [/\.test\.(js|ts)x?$/, /\.spec\.(js|ts)x?$/],
      maxFileSize: 1024 * 1024 // 1MB
    };
  }

  async analyzeFile(filePath: string, progress?: ProgressTracker): Promise<AnalysisResult | null> {
    try {
      // Check file size
      const stats = await fs.stat(filePath);
      if (stats.size > this.config.maxFileSize) {
        logger.warn(`File ${filePath} exceeds size limit of ${this.config.maxFileSize} bytes`);
      }

      // Check ignore patterns
      if (this.config.ignorePatterns.some(pattern => pattern.test(filePath))) {
        logger.debug(`Skipping ignored file ${filePath}`);
        return null;
      }

      // Update progress
      if (progress) {
        progress.increment();
      }

      // Check cache
      const cached = await cacheManager.get(filePath);
      if (cached) {
        logger.debug(`Using cached analysis for ${filePath}`);
        return cached;
      }

      const content = await fs.readFile(filePath, 'utf8');
      // Get file extension for potential future use
      // const ext = path.extname(filePath);
      
      const results: AnalysisResult = {
        path: filePath,
        issues: [],
        suggestions: []
      };

      // Check function documentation
      const functionIssues = this.checkFunctionDocs(content);
      results.issues.push(...functionIssues);

      // Check class documentation
      const classIssues = this.checkClassDocs(content);
      results.issues.push(...classIssues);

      // Check parameter documentation
      const paramIssues = this.checkParamDocs(content);
      results.issues.push(...paramIssues);

      // Generate suggestions
      results.suggestions = this.generateSuggestions(results.issues);

      return results;
    } catch (error) {
      logger.error('Documentation analysis failed:', error);
      throw new Error(`Analysis failed for ${filePath}: ${(error as Error).message}`);
    }
  }

  checkFunctionDocs(content: string): Issue[] {
    const issues: Issue[] = [];
    
    // Match function declarations
    const functionRegex = /(?:function|const|let|var)\s+(\w+)\s*=?\s*(?:function|\()/g;
    let match: RegExpExecArray | null;
    
    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1];
      const precedingContent = content.slice(Math.max(0, match.index - 200), match.index);
      
      // Check for JSDoc comment
      if (!precedingContent.includes('/**')) {
        issues.push({
          type: 'missing-function-doc',
          name: functionName,
          line: this.getLineNumber(content, match.index),
          message: `Missing documentation for function "${functionName}"`
        });
      }
      // Check for incomplete JSDoc
      else if (!this.hasRequiredTags(precedingContent)) {
        issues.push({
          type: 'incomplete-function-doc',
          name: functionName,
          line: this.getLineNumber(content, match.index),
          message: `Incomplete documentation for function "${functionName}"`
        });
      }
    }

    return issues;
  }

  checkClassDocs(content: string): Issue[] {
    const issues: Issue[] = [];
    
    // Match class declarations
    const classRegex = /class\s+(\w+)/g;
    let match: RegExpExecArray | null;
    
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const precedingContent = content.slice(Math.max(0, match.index - 200), match.index);
      
      if (!precedingContent.includes('/**')) {
        issues.push({
          type: 'missing-class-doc',
          name: className,
          line: this.getLineNumber(content, match.index),
          message: `Missing documentation for class "${className}"`
        });
      }
    }

    return issues;
  }

  checkParamDocs(content: string): Issue[] {
    const issues: Issue[] = [];
    
    // Match function parameters
    const paramRegex = /(?:function|const|let|var)\s+\w+\s*=?\s*\(([^)]*)\)/g;
    let match: RegExpExecArray | null;
    
    while ((match = paramRegex.exec(content)) !== null) {
      const params = match[1].split(',').map(p => p.trim()).filter(Boolean);
      const precedingContent = content.slice(Math.max(0, match.index - 200), match.index);
      
      params.forEach(param => {
        const paramName = param.split('=')[0].trim();
        if (!precedingContent.includes(`@param ${paramName}`)) {
          issues.push({
            type: 'missing-param-doc',
            name: paramName,
            line: this.getLineNumber(content, match!.index),
            message: `Missing documentation for parameter "${paramName}"`
          });
        }
      });
    }

    return issues;
  }

  hasRequiredTags(docComment: string): boolean {
    return this.jsdocTags.some(tag => docComment.includes(tag));
  }

  getLineNumber(content: string, index: number): number {
    return content.slice(0, index).split('\n').length;
  }

  generateSuggestions(issues: Issue[]): Suggestion[] {
    return issues.map(issue => {
      switch (issue.type) {
        case 'missing-function-doc':
          return {
            issue,
            suggestion: `Add JSDoc comment block for function "${issue.name}":
/**
 * Description of what the function does
 * @param {Type} paramName - Parameter description
 * @returns {Type} Description of return value
 */`
          };
        
        case 'incomplete-function-doc':
          return {
            issue,
            suggestion: 'Add missing JSDoc tags (@param, @returns, @throws as appropriate)'
          };
        
        case 'missing-class-doc':
          return {
            issue,
            suggestion: `Add JSDoc comment block for class "${issue.name}":
/**
 * Description of the class purpose
 * @class
 */`
          };
        
        case 'missing-param-doc':
          return {
            issue,
            suggestion: `Add @param tag for parameter "${issue.name}":
 * @param {Type} ${issue.name} - Parameter description`
          };
        
        default:
          return {
            issue,
            suggestion: 'Add appropriate documentation'
          };
      }
    });
  }
}

export default new DocAnalyzer();