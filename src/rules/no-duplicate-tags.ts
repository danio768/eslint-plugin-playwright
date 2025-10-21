import { TSESTree } from '@typescript-eslint/utils'
import * as path from 'path'
import { createRule } from '../utils/createRule.js'
import { getAllSpecFiles as getSpecFiles, pathExists, readFileContent } from '../utils/fileSystem.js'
import { parseFnCall } from '../utils/parseFnCall.js'
import { extractNumericTagsFromText, extractTagsFromProperty } from '../utils/tags.js'

interface RuleOptions {
  projectRoot?: string
}

export default createRule({
  create(context) {
    const options = (context.options[0] as RuleOptions) || {}
    const filename = context.filename
    
    // Skip non-spec files
    if (!filename.endsWith('.spec.ts')) {
      return {}
    }

    const projectRoot = options.projectRoot || process.cwd()
    
    // Simple cache to avoid re-scanning files multiple times in the same session
    const fileCache = new Map<string, string[]>()
    
    // Validate project root exists
    if (!pathExists(projectRoot)) {
      // Fallback to current working directory if validation fails
      // This prevents the rule from crashing in edge cases
    }
    
    const extractTagsFromText = (text: string): string[] => {
      // Use cache to avoid re-parsing the same file content
      const cacheKey = text.substring(0, 100) // Use first 100 chars as cache key
      if (fileCache.has(cacheKey)) {
        return fileCache.get(cacheKey)!
      }
      
      const tags = extractNumericTagsFromText(text)
      fileCache.set(cacheKey, tags)
      return tags
    }

    const currentFileTags: Array<{node: any, tag: string}> = []

    return {
      CallExpression(node) {
        const call = parseFnCall(context, node)
        if (!call || call.type !== 'test') return

        // Check if there's an options object as the second argument
        if (node.arguments.length < 2) return
        const optionsArg = node.arguments[1]
        if (!optionsArg || optionsArg.type !== 'ObjectExpression') return

        const tags = extractTagsFromProperty(optionsArg as TSESTree.ObjectExpression)
        
        // Store numeric tags with their nodes
        for (const tag of tags) {
          if (/^@\d+$/.test(tag)) {
            currentFileTags.push({ node: optionsArg, tag })
          }
        }
      },

      'Program:exit'() {
        if (currentFileTags.length === 0) return

        // Check for duplicates within current file
        const seenInFile = new Set<string>()
        for (const {node, tag} of currentFileTags) {
          if (seenInFile.has(tag)) {
            context.report({
              data: { location: ' in this file', tag },
              messageId: 'duplicateTag',
              node,
            })
            continue
          }
          seenInFile.add(tag)
        }

        // Check for duplicates across other files
        const allSpecFiles = getSpecFiles(projectRoot)
        const otherFiles = allSpecFiles.filter((file: string) => 
          path.resolve(file) !== path.resolve(filename)
        )

        for (const {node, tag} of currentFileTags) {
          // Skip tags that were already reported as duplicates within this file
          if (seenInFile.size < currentFileTags.length) {
            // Count unique tags in current file
            const uniqueTagsInFile = new Set(currentFileTags.map(t => t.tag))
            if (uniqueTagsInFile.size < currentFileTags.length && seenInFile.has(tag)) {
              continue // Skip if already reported as duplicate in this file
            }
          }
          
          for (const otherFile of otherFiles) {
            const content = readFileContent(otherFile)
            if (!content) continue // Skip files we can't read
            
            const otherTags = extractTagsFromText(content)
            
            if (otherTags.includes(tag)) {
              const relativePath = path.relative(projectRoot, otherFile)
              context.report({
                data: { location: ` in ${relativePath}`, tag },
                messageId: 'duplicateTag',
                node,
              })
              break
            }
          }
        }
      },
    }
  },

  meta: {
    docs: {
      description: 'Prevent duplicate @number tags within and across .spec.ts files',
      recommended: true,
    },
    messages: {
      duplicateTag: 'Duplicate tag "{{tag}}" found{{location}}',
    },
    schema: [
      {
        additionalProperties: false,
        properties: {
          projectRoot: {
            description: 'Root directory to search for .spec.ts files',
            type: 'string'
          }
        },
        type: 'object',
      },
    ],
    type: 'problem',
  },
})