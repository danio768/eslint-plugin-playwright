import { TSESTree } from '@typescript-eslint/utils'
import { createRule } from '../utils/createRule.js'
import { parseFnCall } from '../utils/parseFnCall.js'
import {
  extractTagsFromProperty,
  extractTagsFromText,
  findTagPropertyNode,
  matchesPattern,
} from '../utils/tags.js'

interface TagPool {
  exclude?: (string | { flags?: string; source: string })[]
  name: string
  pattern: string | { flags?: string; source: string }
}

interface RuleOptions {
  sharedPaths?: string[]
  tagPools?: TagPool[]
}

export default createRule({
  create(context) {
    const options = (context.options[0] as RuleOptions) || {}
    const tagPools = options.tagPools || []
    const sharedPaths = options.sharedPaths || []

    // Configuration validation
    if (tagPools.length === 0) {
      return {} // No validation if no tag pools configured
    }

    // Validate tag pool configurations
    for (const pool of tagPools) {
      if (!pool.name || typeof pool.name !== 'string') {
        throw new Error(
          'Each tag pool must have a name property of type string',
        )
      }
      if (!pool.pattern) {
        throw new Error(`Tag pool "${pool.name}" must have a pattern property`)
      }
    }

    const filename = context.filename

    // Skip non-spec files
    if (!filename.endsWith('.spec.ts')) {
      return {}
    }

    // Skip shared directories
    const isSharedPath = sharedPaths.some((shared: string) =>
      new RegExp(`(^|[\\\\/])${shared}([\\\\/]|$)`, 'i').test(filename),
    )
    if (isSharedPath) {
      return {}
    }

    // Helper to check if tag should be excluded
    const isExcluded = (
      tag: string,
      excludes: (string | { flags?: string; source: string })[] = [],
    ): boolean => {
      return excludes.some((exclude) => {
        if (typeof exclude === 'string') {
          // Literal string match
          return tag === exclude || tag.toLowerCase() === exclude.toLowerCase()
        }
        // Pattern match
        return matchesPattern(tag, exclude)
      })
    }

    // Check if tag matches a tag pool
    const matchesTagPool = (tag: string, pool: TagPool): boolean => {
      if (!matchesPattern(tag, pool.pattern)) {
        return false
      }

      if (isExcluded(tag, pool.exclude)) {
        return false
      }

      return true
    }

    const allTestTags: string[] = []
    const allTemplateLiterals: TSESTree.TemplateLiteral[] = []
    let firstTestNode: any = null
    let firstTagNode: any = null
    let hasAnyTest = false

    return {
      CallExpression(node) {
        const call = parseFnCall(context, node)

        // Handle both test() and test.describe() calls
        if (!call || (call.type !== 'test' && call.type !== 'describe')) return

        if (call.type === 'test') {
          hasAnyTest = true

          // Store first test node for error reporting if we don't have one yet
          if (!firstTestNode) {
            firstTestNode = node
          }
        }

        // Check if there's an options object as the second argument
        if (node.arguments.length < 2) return
        const optionsArg = node.arguments[1]
        if (!optionsArg || optionsArg.type !== 'ObjectExpression') return

        const tags = extractTagsFromProperty(
          optionsArg as TSESTree.ObjectExpression,
        )

        // Separate string tags from template literal nodes
        for (const tag of tags) {
          if (typeof tag === 'string') {
            allTestTags.push(tag)
          } else if (tag.type === 'templateLiteral') {
            allTemplateLiterals.push(tag.node)
          }
        }

        // Store the first tag node for better error reporting
        if (!firstTagNode && optionsArg) {
          firstTagNode = findTagPropertyNode(optionsArg as any)
        }
      },

      'Program:exit'() {
        if (!hasAnyTest) return

        // If we didn't collect many tags via AST, try text-based extraction as fallback
        // This approach is inspired by the working version
        if (allTestTags.length === 0) {
          const text = context.sourceCode.getText()
          const textTags = extractTagsFromText(text)
          allTestTags.push(...textTags)
        }

        // Validate each required tag pool
        for (const pool of tagPools) {
          // Special handling for literal string exemption tags (like @noid)
          // Only literal string exclusions make the pool optional, not regex exclusions
          const hasExemptionTag =
            pool.exclude &&
            pool.exclude.some((exclusion) => {
              if (typeof exclusion === 'string') {
                return allTestTags.some(
                  (tag) =>
                    tag === exclusion ||
                    tag.toLowerCase() === exclusion.toLowerCase(),
                )
              }
              return false // Regex exclusions don't make pools optional
            })

          if (hasExemptionTag) {
            continue // Skip this requirement since exemption tag is present
          }

          // Check if any tag matches this pool
          const found = allTestTags.some((tag) => matchesTagPool(tag, pool))

          if (!found) {
            context.report({
              data: { tagType: pool.name },
              messageId: 'missingTag',
              node: firstTagNode ||
                firstTestNode || {
                  loc: {
                    end: { column: 1, line: 1 },
                    start: { column: 0, line: 1 },
                  },
                },
              suggest: [
                {
                  data: { tagType: pool.name },
                  fix: () => {
                    // Auto-fix for adding tags is complex as it requires determining
                    // the correct location in the options object. For now, we provide
                    // a suggestion message to guide manual fixing.
                    return null
                  },
                  messageId: 'suggestAddTag',
                },
              ],
            })
          }
        }
      },
    }
  },

  meta: {
    docs: {
      description:
        'Enforce required tags in Playwright test files (file-level validation)',
      recommended: true,
    },
    hasSuggestions: true,
    messages: {
      missingTag: 'Missing required tag type in file: {{tagType}}',
      suggestAddTag: 'Add {{tagType}} tag to test.describe or test',
    },
    schema: [
      {
        additionalProperties: false,
        properties: {
          sharedPaths: {
            description: 'List of shared directory paths to ignore',
            items: { type: 'string' },
            type: 'array',
          },
          tagPools: {
            description: 'Array of tag pools to validate',
            items: {
              additionalProperties: false,
              properties: {
                exclude: {
                  description:
                    'Patterns or literal strings to exclude from matching',
                  items: {
                    oneOf: [
                      { type: 'string' },
                      {
                        additionalProperties: false,
                        properties: {
                          flags: { type: 'string' },
                          source: { type: 'string' },
                        },
                        required: ['source'],
                        type: 'object',
                      },
                    ],
                  },
                  type: 'array',
                },
                name: {
                  description: 'Name of the tag pool (used in error messages)',
                  type: 'string',
                },
                pattern: {
                  description:
                    'Regex pattern to match tags (string or {source, flags} object)',
                  oneOf: [
                    { type: 'string' },
                    {
                      additionalProperties: false,
                      properties: {
                        flags: { type: 'string' },
                        source: { type: 'string' },
                      },
                      required: ['source'],
                      type: 'object',
                    },
                  ],
                },
              },
              required: ['name', 'pattern'],
              type: 'object',
            },
            type: 'array',
          },
        },
        type: 'object',
      },
    ],
    type: 'problem',
  },
})
