# No Duplicate Tags

Prevents duplicate `@number` tags within and across test files to ensure unique
test identification.

## Rule Details

This rule detects when the same `@number` tag (like `@123`, `@456`) is used in
multiple tests, either within the same `.spec.ts` file or across different
files. This is useful for ensuring unique test case identifiers for issue
tracking or test management systems.

### Examples

```ts
// ❌ Incorrect - @123 appears in multiple tests within same file
test('first test', { tag: '@123' }, async ({ page }) => {})
test('second test', { tag: '@123' }, async ({ page }) => {})
```

```ts
// ❌ Incorrect - @123 appears in multiple tests across files
// file1.spec.ts
test('first test', { tag: '@123' }, async ({ page }) => {})

// file2.spec.ts
test('second test', { tag: '@123' }, async ({ page }) => {})
```

```ts
// ✅ Correct - each test has unique @number tags within file
test('first test', { tag: '@123' }, async ({ page }) => {})
test('second test', { tag: '@456' }, async ({ page }) => {})
```

```ts
// ✅ Correct - each test has unique @number tags across files
// file1.spec.ts
test('first test', { tag: '@123' }, async ({ page }) => {})

// file2.spec.ts
test('second test', { tag: '@456' }, async ({ page }) => {})
```

```ts
// ✅ Correct - non-number tags can be duplicated
test('test one', { tag: '@team-frontend' }, async ({ page }) => {})
test('test two', { tag: '@team-frontend' }, async ({ page }) => {})
```

```ts
// ✅ Correct - dynamic tags are ignored
test('test one', { tag: '@${caseData.id}' }, async ({ page }) => {})
test('test two', { tag: '@${caseData.id}' }, async ({ page }) => {})
```

## What it checks

- Scans all `.spec.ts` files in the workspace
- Extracts `@number` pattern tags (e.g., `@123`, `@4567`)
- Reports duplicate usage within the same file
- Reports duplicate usage across different files
- Ignores:
  - Non-number tags (e.g., `@team-frontend`, `@api`)
  - Dynamic tags with template expressions (e.g., `@${variable}`)

## Options

```ts
interface RuleOptions {
  projectRoot?: string
}
```

### Configuration

```js
// eslint.config.js
export default [
  {
    files: ['**/*.spec.ts'],
    rules: {
      'playwright/no-duplicate-tags': [
        'error',
        {
          projectRoot: './tests', // Limit scanning to tests directory
        },
      ],
    },
  },
]
```

### Option Details

- **`projectRoot`** (string, optional): Root directory to search for `.spec.ts`
  files
  - Default: `process.cwd()` (current working directory)
  - Useful for limiting scan scope in large repositories
  - Improves performance by avoiding unnecessary directory traversal
  - Example values: `'./tests'`, `'./e2e'`, `'./src/test'`

### Performance Optimization

For large projects, specifying a `projectRoot` can significantly improve
performance:

```js
// Only scan the e2e test directory instead of entire repository
{
  'playwright/no-duplicate-tags': ['error', {
    projectRoot: './tests/e2e'
  }]
}
```

## When To Use

- When you use numeric tags as unique test case identifiers
- When integrating with test management systems that require unique IDs
- When you need to prevent accidental reuse of test case numbers
- When you want to enforce unique numeric tags both within files and across your
  entire test suite
- In large projects where developers might accidentally use the same number

## When Not To Use

- If you don't use numeric tags for test identification
- If you intentionally want to allow duplicate numeric tags
- If your tagging system doesn't rely on unique numeric identifiers

## Related Rules

- [`require-test-tags`](./require-test-tags.md) - Enforces required tag
  categories
- [`valid-test-tags`](./valid-test-tags.md) - Validates tag format and allowed
  values

## Examples in Practice

### Issue Tracking Integration

```ts
// Each test maps to a unique issue/ticket number
test('login flow', { tag: '@1001' }, async ({ page }) => {})
test('logout flow', { tag: '@1002' }, async ({ page }) => {})
test('password reset', { tag: '@1003' }, async ({ page }) => {})
```

### Test Case Management

```ts
// Integration with external test case management tools
test(
  'user registration',
  {
    tag: ['@TC001', '@functional', '@high-priority'],
  },
  async ({ page }) => {},
)

test(
  'user profile update',
  {
    tag: ['@TC002', '@functional', '@medium-priority'],
  },
  async ({ page }) => {},
)
```

### Multi-tag Scenarios

```ts
// Rule only checks @number patterns, other tags can duplicate
test(
  'dashboard test',
  {
    tag: ['@501', '@dashboard', '@smoke'],
  },
  async ({ page }) => {},
)

test(
  'settings test',
  {
    tag: ['@502', '@dashboard', '@smoke'], // @dashboard, @smoke can repeat
  },
  async ({ page }) => {},
)
```

### Within Same File

```ts
// ❌ This will trigger duplicate errors
test('first test', { tag: '@123' }, async ({ page }) => {})
test('second test', { tag: '@123' }, async ({ page }) => {}) // Error: Duplicate tag "@123" found in this file
```

### Across Different Files

```ts
// file1.spec.ts
test('login test', { tag: '@123' }, async ({ page }) => {})

// file2.spec.ts
test('logout test', { tag: '@123' }, async ({ page }) => {}) // Error: Duplicate tag "@123" found in file1.spec.ts
```

### Multiple Duplicate Locations

When a tag appears in multiple files, all locations are reported:

```ts
// file1.spec.ts
test('test A', { tag: '@999' }, async ({ page }) => {})

// file2.spec.ts
test('test B', { tag: '@999' }, async ({ page }) => {})

// file3.spec.ts
test('test C', { tag: '@999' }, async ({ page }) => {}) // Error: Duplicate tag "@999" found in file1.spec.ts, file2.spec.ts
```
