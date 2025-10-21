import { TSESTree } from '@typescript-eslint/utils'
import { getStringValue } from './ast.js'

/**
 * Extracts tags from a Playwright test options object tag property.
 * Handles both single tag strings and arrays of tags, including template literals.
 */
export function extractTagsFromProperty(node: TSESTree.ObjectExpression): string[] {
  const tagProperty = node.properties.find(
    (prop) =>
      prop.type === 'Property' &&
      !('argument' in prop) &&
      prop.key.type === 'Identifier' &&
      prop.key.name === 'tag',
  ) as TSESTree.Property | undefined

  if (!tagProperty) return []

  const tagValue = tagProperty.value
  if (tagValue.type === 'Literal' && typeof tagValue.value === 'string') {
    return [tagValue.value]
  } else if (tagValue.type === 'ArrayExpression') {
    return tagValue.elements
      .filter((element): element is TSESTree.Literal => 
        element?.type === 'Literal' && typeof element.value === 'string'
      )
      .map(element => element.value as string)
  } else if (tagValue.type === 'TemplateLiteral') {
    // Use getStringValue for consistent template literal handling
    const value = getStringValue(tagValue as any)
    return value ? [value] : []
  }
  return []
}

/**
 * Finds the tag property node within an options object for error reporting.
 * Returns the tag property node if found, otherwise the options object itself.
 */
export function findTagPropertyNode(node: TSESTree.ObjectExpression): TSESTree.Node {
  const tagProperty = node.properties.find(
    (prop) =>
      prop.type === 'Property' &&
      !('argument' in prop) &&
      prop.key.type === 'Identifier' &&
      prop.key.name === 'tag',
  )
  return tagProperty || node
}

/**
 * Extracts numeric tags (format: @123) from text content.
 * Used for cross-file duplicate detection.
 */
export function extractNumericTagsFromText(text: string): string[] {
  // Extract tags from tag arrays and single tags
  const tagMatches = text.match(/tag\s*:\s*(?:\[([^\]]*)\]|['"`]([^'"`]*)['"`])/g) || []
  const tags: string[] = []
  
  for (const match of tagMatches) {
    if (match.includes('[')) {
      // Array format: tag: ['@123', '@456']
      const arrayContent = match.match(/\[([^\]]*)\]/)?.[1] || ''
      const arrayTags = arrayContent
        .split(',')
        .map(t => t.replace(/['"`]/g, '').trim())
        .filter(Boolean)
        .filter(tag => /^@\d+$/.test(tag)) // Only numeric tags
      tags.push(...arrayTags)
    } else {
      // Single tag format: tag: '@123'
      const singleTag = match.match(/['"`]([^'"`]*)['"`]/)?.[1]
      if (singleTag && /^@\d+$/.test(singleTag)) {
        tags.push(singleTag)
      }
    }
  }
  
  return tags
}

/**
 * Creates a RegExp from a pattern string or object configuration.
 * Follows the same pattern as valid-test-tags rule.
 */
function createRegExpFromPattern(pattern: string | { flags?: string; source: string }): RegExp {
  if (typeof pattern === 'string') {
    return new RegExp(pattern, 'i')
  }
  return new RegExp(pattern.source, pattern.flags || 'i')
}

/**
 * Checks if a tag matches a pattern (string or regex object).
 */
export function matchesPattern(tag: string, pattern: string | { flags?: string; source: string }): boolean {
  const regex = createRegExpFromPattern(pattern)
  return regex.test(tag)
}