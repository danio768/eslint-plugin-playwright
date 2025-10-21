import { TSESTree } from '@typescript-eslint/utils'
import { getStringValue } from './ast.js'

/**
 * Attempts to reconstruct a template literal preserving template syntax. This
 * allows template literals to be validated against regex patterns that support
 * both static values and template literal expressions.
 */
function reconstructTemplateLiteral(
  templateLiteral: TSESTree.TemplateLiteral,
): string | null {
  // If it's a simple template with no expressions, return the raw value
  if (
    templateLiteral.expressions.length === 0 &&
    templateLiteral.quasis.length === 1
  ) {
    return templateLiteral.quasis[0].value.raw
  }

  // For templates with expressions, preserve the template literal syntax
  // This allows regex patterns to match both static values and template expressions
  let result = ''

  for (let i = 0; i < templateLiteral.quasis.length; i++) {
    result += templateLiteral.quasis[i].value.raw

    if (i < templateLiteral.expressions.length) {
      const expression = templateLiteral.expressions[i]

      // Preserve the template literal syntax for pattern matching
      result += '${'

      if (
        expression.type === 'MemberExpression' &&
        expression.object.type === 'Identifier' &&
        expression.property.type === 'Identifier'
      ) {
        // For ${data.testCaseId}, preserve as ${data.testCaseId}
        result += `${expression.object.name}.${expression.property.name}`
      } else if (expression.type === 'Identifier') {
        // For ${variable}, preserve as ${variable}
        result += expression.name
      } else {
        // For complex expressions, use a generic placeholder for pattern matching
        result += 'expr'
      }

      result += '}'
    }
  }

  return result
}

/**
 * Extracts tags from a Playwright test options object tag property. Handles
 * both single tag strings and arrays of tags, including template literals.
 */
export function extractTagsFromProperty(
  node: TSESTree.ObjectExpression,
): Array<string | { type: 'templateLiteral'; node: TSESTree.TemplateLiteral }> {
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
    const tags: Array<
      string | { type: 'templateLiteral'; node: TSESTree.TemplateLiteral }
    > = []

    for (const element of tagValue.elements) {
      if (!element) continue

      if (element.type === 'Literal' && typeof element.value === 'string') {
        tags.push(element.value)
      } else if (element.type === 'TemplateLiteral') {
        // For simple templates (no expressions), use the raw value
        const reconstructed = reconstructTemplateLiteral(element)
        if (reconstructed) {
          tags.push(reconstructed)
        } else {
          // For complex templates with expressions, return the node for pattern checking
          tags.push({ type: 'templateLiteral', node: element })
        }
      }
    }

    return tags
  } else if (tagValue.type === 'TemplateLiteral') {
    // Use reconstruction for single template literals
    const reconstructed = reconstructTemplateLiteral(tagValue)
    if (reconstructed) {
      return [reconstructed]
    }
    // For complex templates, return the node
    return [{ type: 'templateLiteral', node: tagValue }]
  }

  return []
}

/**
 * Finds the tag property node within an options object for error reporting.
 * Returns the tag property node if found, otherwise the options object itself.
 */
export function findTagPropertyNode(
  node: TSESTree.ObjectExpression,
): TSESTree.Node {
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
 * Extracts tags from text using regex patterns. This is a fallback method
 * inspired by the working version when AST parsing doesn't capture all tags
 * properly.
 */
export function extractTagsFromText(text: string): string[] {
  // Find all tag arrays in the file (e.g., tag: [ ... ])
  const tagArrayRegex = /tag\s*:\s*\[([^\]]*)\]/g
  let match
  const allTags: string[] = []

  while ((match = tagArrayRegex.exec(text)) !== null) {
    const tagContent = match[1]

    // Extract individual tags, handling both strings and template literals
    const tagMatches =
      tagContent.match(/(['"`])((?:(?!\1)[^\\]|\\.)*)(\1|`[^`]*`)/g) || []

    for (const tagMatch of tagMatches) {
      let tag = tagMatch.replace(/^['"`]|['"`]$/g, '')

      // If it's a template literal, preserve the syntax
      if (tagMatch.startsWith('`') || tagMatch.includes('${')) {
        // Keep template literal syntax for pattern matching
        tag = tagMatch.replace(/^`|`$/g, '')
      }

      if (tag.trim()) {
        allTags.push(tag.trim())
      }
    }
  }

  return allTags
}

/**
 * Extracts numeric tags (format: @123) from text content. Used for cross-file
 * duplicate detection.
 */
export function extractNumericTagsFromText(text: string): string[] {
  // Extract tags from tag arrays and single tags
  const tagMatches =
    text.match(/tag\s*:\s*(?:\[([^\]]*)\]|['"`]([^'"`]*)['"`])/g) || []
  const tags: string[] = []

  for (const match of tagMatches) {
    if (match.includes('[')) {
      // Array format: tag: ['@123', '@456']
      const arrayContent = match.match(/\[([^\]]*)\]/)?.[1] || ''
      const arrayTags = arrayContent
        .split(',')
        .map((t) => t.replace(/['"`]/g, '').trim())
        .filter(Boolean)
        .filter((tag) => /^@\d+$/.test(tag)) // Only numeric tags
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
 * Creates a RegExp from a pattern string or object configuration. Follows the
 * same pattern as valid-test-tags rule.
 */
function createRegExpFromPattern(
  pattern: string | { flags?: string; source: string },
): RegExp {
  if (typeof pattern === 'string') {
    return new RegExp(pattern, 'i')
  }
  return new RegExp(pattern.source, pattern.flags || 'i')
}

/** Checks if a tag matches a pattern (string or regex object). */
export function matchesPattern(
  tag: string,
  pattern: string | { flags?: string; source: string },
): boolean {
  const regex = createRegExpFromPattern(pattern)
  return regex.test(tag)
}
