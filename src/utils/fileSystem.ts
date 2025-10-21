import * as fs from 'fs'
import * as path from 'path'

/**
 * Recursively searches for .spec.ts files in a directory.
 * Includes performance optimizations like depth limiting and directory exclusions.
 */
export function getAllSpecFiles(projectRoot: string): string[] {
  const files: string[] = []
  const maxDepth = 10 // Prevent infinite recursion
  const excludedDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage']
  
  const searchDir = (dir: string, depth = 0) => {
    if (depth > maxDepth) return
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          // Skip common directories that typically don't contain tests
          if (!excludedDirs.includes(entry.name)) {
            searchDir(fullPath, depth + 1)
          }
        } else if (entry.name.endsWith('.spec.ts')) {
          files.push(fullPath)
        }
      }
    } catch {
      // Ignore directories we can't read (permissions, etc.)
    }
  }
  
  searchDir(projectRoot)
  return files
}

/**
 * Safely checks if a path exists, with fallback error handling.
 */
export function pathExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath)
  } catch {
    return false
  }
}

/**
 * Safely reads a file's content with error handling.
 */
export function readFileContent(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return null
  }
}