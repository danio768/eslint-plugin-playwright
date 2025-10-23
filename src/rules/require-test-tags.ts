import { TSESTree } from '@typescript-eslint/utils'
import { createRule } from '../utils/createRule.js'
import { parseFnCall } from '../utils/parseFnCall.js'
import {
  extractTagsFromProperty,
  extractTagsFromText,
  findTagPropertyNode,
  matchesPattern,
  reconstructTemplateLiteral,
} from '../utils/tags.js'

interface TagPool {
  exclude?: (string | { flags?: string; source: string })[]
  granularReporting?: boolean
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

    // Track describe blocks and their tags for inheritance
    const describeStack: Array<{
      node: any
      tags: string[]
      templateLiterals: TSESTree.TemplateLiteral[]
    }> = []

    // Track individual test calls with their inherited context
    const testCalls: Array<{
      inheritedTags: string[]
      inheritedTemplateLiterals: TSESTree.TemplateLiteral[]
      node: any
      ownTags: string[]
      ownTemplateLiterals: TSESTree.TemplateLiteral[]
      title: string
    }> = []

    return {
      CallExpression(node) {
        const call = parseFnCall(context, node)

        // Handle both test() and test.describe() calls
        if (!call || (call.type !== 'test' && call.type !== 'describe')) return

        // Extract tags from this call's options
        const callTags: string[] = []
        const callTemplateLiterals: TSESTree.TemplateLiteral[] = []

        if (node.arguments.length >= 2) {
          const optionsArg = node.arguments[1]
          if (optionsArg && optionsArg.type === 'ObjectExpression') {
            const tags = extractTagsFromProperty(
              optionsArg as TSESTree.ObjectExpression,
            )

            for (const tag of tags) {
              if (typeof tag === 'string') {
                callTags.push(tag)
                allTestTags.push(tag)
              } else if (tag.type === 'templateLiteral') {
                callTemplateLiterals.push(tag.node)
                allTemplateLiterals.push(tag.node)
              }
            }

            // Store the first tag node for fallback error reporting
            if (!firstTagNode) {
              firstTagNode = findTagPropertyNode(optionsArg as any)
            }
          }
        }

        if (call.type === 'describe') {
          // Calculate inherited tags from parent describes
          const inheritedTags = describeStack.flatMap((desc) => desc.tags)
          const inheritedTemplateLiterals = describeStack.flatMap(
            (desc) => desc.templateLiterals,
          )

          // Push this describe onto the stack
          describeStack.push({
            node,
            tags: [...inheritedTags, ...callTags],
            templateLiterals: [
              ...inheritedTemplateLiterals,
              ...callTemplateLiterals,
            ],
          })
        } else if (call.type === 'test') {
          hasAnyTest = true

          // Store first test node for fallback error reporting
          if (!firstTestNode) {
            firstTestNode = node
          }

          // Calculate inherited tags from all parent describes
          const inheritedTags = describeStack.flatMap((desc) => desc.tags)
          const inheritedTemplateLiterals = describeStack.flatMap(
            (desc) => desc.templateLiterals,
          )

          // Extract test title for error reporting
          let testTitle = 'unknown test'
          if (node.arguments[0] && node.arguments[0].type === 'Literal') {
            testTitle = String(node.arguments[0].value)
          } else if (
            node.arguments[0] &&
            node.arguments[0].type === 'TemplateLiteral'
          ) {
            testTitle = context.sourceCode.getText(node.arguments[0])
          }

          // Track this test call
          testCalls.push({
            inheritedTags,
            inheritedTemplateLiterals,
            node,
            ownTags: callTags,
            ownTemplateLiterals: callTemplateLiterals,
            title: testTitle,
          })
        }
      },

      'CallExpression:exit'(node) {
        const call = parseFnCall(context, node)
        if (call && call.type === 'describe') {
          // Pop the describe from the stack when exiting
          describeStack.pop()
        }
      },

      'Program:exit'() {
        if (!hasAnyTest) return

        // If we didn't collect many tags via AST, try text-based extraction as fallback
        if (allTestTags.length === 0) {
          const text = context.sourceCode.getText()
          const textTags = extractTagsFromText(text)
          allTestTags.push(...textTags)
        }

        // Process each tag pool with its own validation mode
        for (const pool of tagPools) {
          if (pool.granularReporting) {
            // Granular reporting: Validate each test call individually with inheritance
            for (const testCall of testCalls) {
              // Combine inherited and own tags for this specific test
              const availableTags = [
                ...testCall.inheritedTags,
                ...testCall.ownTags,
              ]
              const availableTemplateLiterals = [
                ...testCall.inheritedTemplateLiterals,
                ...testCall.ownTemplateLiterals,
              ]

              // Check if any excluded tag is present - skip validation if found
              if (
                pool.exclude &&
                pool.exclude.some((exclusion) => {
                  if (typeof exclusion === 'string') {
                    return availableTags.some(
                      (tag) =>
                        tag === exclusion ||
                        tag.toLowerCase() === exclusion.toLowerCase(),
                    )
                  }
                  // Handle regex pattern objects
                  return availableTags.some((tag) =>
                    matchesPattern(tag, exclusion),
                  )
                })
              ) {
                continue // Skip validation for this test call
              }

              // Check if any available tag matches this pool
              const found =
                availableTags.some((tag) => matchesTagPool(tag, pool)) ||
                availableTemplateLiterals.some((templateLiteral) => {
                  const reconstructed =
                    reconstructTemplateLiteral(templateLiteral)
                  return reconstructed && matchesTagPool(reconstructed, pool)
                })

              if (!found) {
                context.report({
                  data: {
                    tagType: pool.name,
                    testTitle: testCall.title,
                  },
                  messageId: 'missingTagInTest',
                  node: testCall.node,
                  suggest: [
                    {
                      data: { tagType: pool.name },
                      fix: () => null,
                      messageId: 'suggestAddTag',
                    },
                  ],
                })
              }
            }
          } else {
            // File-level validation: Check if tag pool requirement exists anywhere in file

            // Check if any excluded tag is present - skip validation if found
            if (
              pool.exclude &&
              pool.exclude.some((exclusion) => {
                if (typeof exclusion === 'string') {
                  return allTestTags.some(
                    (tag) =>
                      tag === exclusion ||
                      tag.toLowerCase() === exclusion.toLowerCase(),
                  )
                }
                // Handle regex pattern objects
                return allTestTags.some((tag) => matchesPattern(tag, exclusion))
              })
            ) {
              continue // Skip validation for this pool
            }

            const found =
              allTestTags.some((tag) => matchesTagPool(tag, pool)) ||
              allTemplateLiterals.some((templateLiteral) => {
                const reconstructed =
                  reconstructTemplateLiteral(templateLiteral)
                return reconstructed && matchesTagPool(reconstructed, pool)
              })

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
                    fix: () => null,
                    messageId: 'suggestAddTag',
                  },
                ],
              })
            }
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
      missingTagInTest:
        'Test "{{testTitle}}" missing {{tagType}} tag (not inherited from parent describe)',
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
                granularReporting: {
                  default: false,
                  description:
                    'Enable per-test validation with inheritance for this tag pool (vs file-level validation)',
                  type: 'boolean',
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
