# Require Test Tags

Enforces that test files have required tags based on configurable tag pools.
Tags can be distributed across `test.describe` and `test` calls within the same
file.

## Rule Details

This rule validates that each test file includes tags from all required tag
pools. Tag pools are completely configurable, allowing you to define custom tag
categories with their own patterns and exclusions.

**Important**: By default, the rule checks for tag coverage across the entire file, not per
individual test. Tags can be inherited from `test.describe` blocks or
distributed across multiple `test` calls. However, you can enable **granular reporting**
for specific tag pools to validate each test individually.

**Template Literal Support**: The rule supports both static string tags and
template literals. Template literals with expressions are reconstructed
preserving their syntax for pattern matching.

**Granular Reporting**: Enable per-test validation for specific tag pools when you need
stricter enforcement. This is particularly useful for tracking identifiers or metadata
that should be present on every individual test.

### Examples

```ts
// ❌ Incorrect - missing required tag types in the file
test('my test', { tag: ['@team-frontend'] }, async ({ page }) => {})
```

```ts
// ✅ Correct - has all required tag types in a single test
test(
  'my test',
  {
    tag: ['@123', '@team-frontend', '@user-service', '@api'],
  },
  async ({ page }) => {},
)
```

```ts
// ✅ Correct - template literal tags are supported
const data = { testCaseId: '123' }
test.describe(
  'API Tests',
  {
    tag: ['@team-frontend', '@user-service'],
  },
  () => {
    test(
      'should process request',
      {
        tag: [`@${data.testCaseId}`, '@api'], // Reconstructed as @${data.testCaseId} for pattern matching
      },
      async ({ page }) => {},
    )
  },
)
```

```ts
// ✅ Correct - granular reporting validates each test individually
test.describe(
  'user management',
  {
    tag: ['@team-frontend', '@user-service'], // Shared across all tests in describe
  },
  () => {
    test(
      'create user',
      {
        tag: ['@123', '@api'], // This test has ID @123
      },
      async ({ page }) => {},
    )

    test(
      'delete user', 
      {
        tag: ['@456', '@api'], // This test has ID @456
      },
      async ({ page }) => {},
    )
  },
)
```

```ts
// ✅ Correct - tags distributed across test.describe and test calls
test.describe(
  'user management',
  {
    tag: ['@123', '@team-frontend'],
  },
  () => {
    test(
      'create user',
      {
        tag: ['@user-service', '@api'],
      },
      async ({ page }) => {},
    )

    test('delete user', async ({ page }) => {})
  },
)
```

```ts
// ✅ Correct - exemption tag makes requirement optional
test(
  'my test',
  {
    tag: ['@noid', '@team-frontend', '@user-service', '@api'],
  },
  async ({ page }) => {},
)
```

## Configuration

Configure the rule to define multiple tag pools with their own requirements:

```json
{
  "rules": {
    "playwright/require-test-tags": [
      "error",
      {
        "pools": [
          {
            "name": "ID",
            "pattern": "^@(\\d+|\\$\\{[^}]*testCaseId[^}]*\\})$",
            "exemptions": ["@noid"],
            "granularReporting": true
          },
          {
            "name": "Team",
            "pattern": "^@team-.+$"
          },
          {
            "name": "Service",
            "pattern": "^@(user-service|payment-service|auth-service)$"
          },
          {
            "name": "Type",
            "pattern": "^@(api|ui|integration|e2e)$"
          }
        ]
      }
    ]
  }
}
```

**Granular Reporting**: Set `granularReporting: true` on a tag pool to validate each
individual test instead of checking file-level coverage. This ensures every test has
the required tags, not just the file as a whole.

**Pattern Notes**:

- For template literals, use patterns like
  `^@(\\d+|\\$\\{[^}]*testCaseId[^}]*\\})$` to match both static IDs and
  template expressions
- Use single backslashes in JSON configuration (e.g., `\\d+`, `\\$`, `\\{`) for
  proper regex escaping

## Options

```ts
interface RuleOptions {
  tagPools?: TagPool[]
  sharedPaths?: string[]
}

interface TagPool {
  name: string
  pattern: string | { source: string; flags?: string }
  exclude?: (string | { source: string; flags?: string })[]
  granularReporting?: boolean
}
```

### Configuration Examples

#### Basic Configuration

```js
// eslint.config.js
export default [
  {
    files: ['**/*.spec.ts'],
    rules: {
      'playwright/require-test-tags': [
        'error',
        {
          tagPools: [
            {
              name: 'Issue ID',
              pattern: '^@\\d+$',
              exclude: ['@noid'],
            },
            {
              name: 'Team',
              pattern: '^@team-',
            },
          ],
          sharedPaths: ['shared'],
        },
      ],
    },
  },
]
```

#### Advanced Configuration

```js
{
  tagPools: [
    {
      name: 'Issue ID',
      pattern: '^@(\\d+|\\$\\{[^}]*id[^}]*\\})$',
      exclude: ['@noid'],
      granularReporting: true // Validate each test individually
    },
    {
      name: 'Component',
      pattern: '^@[a-z0-9_-]+$',
      exclude: [
        { source: '^@team-', flags: 'i' },
        '@noid',
        { source: '^@(frontend|backend|api)$', flags: 'i' },
        { source: '^@\\d+$', flags: 'i' }
      ],
      granularReporting: true // Each test must have component tag
    },
    {
      name: 'Environment',
      pattern: '^@(frontend|backend|api)$'
      // No granularReporting - file-level validation is sufficient
    }
  ],
  sharedPaths: ['shared', 'common']
}
```

### Tag Pool Options

- **`name`** (string): Display name used in error messages
- **`pattern`** (string | object): Regex pattern to match tags
  - String: `"^@team-"`
  - Object: `{ source: "^@team-", flags: "i" }`
- **`exclude`** (array, optional): Patterns or literals to exclude
  - String literals: `["@noid"]` - Makes the requirement optional when present
  - Regex patterns: `[{ source: "^@\\d+$", flags: "i" }]` - Excludes from
    pattern matching
- **`granularReporting`** (boolean, optional): Enable per-test validation
  - `false` (default): File-level validation - tags can be distributed across the file
  - `true`: Per-test validation - each individual test must have matching tags

**Note**: All defined tag pools are required. If you configure a tag pool, it
will be enforced for all tests.

## Granular Reporting vs File-Level Validation

### File-Level Validation (Default)
```ts
// ✅ Valid - tags distributed across describe and test
test.describe('suite', { tag: ['@team-frontend'] }, () => {
  test('test 1', { tag: ['@123'] }, async () => {}) // Has @team-frontend from describe
  test('test 2', async () => {}) // Also has @team-frontend from describe
})
```

### Granular Reporting (Per-Test)
```ts
// ❌ Invalid with granularReporting: true for ID pool
test.describe('suite', { tag: ['@team-frontend'] }, () => {
  test('test 1', { tag: ['@123'] }, async () => {}) // ✅ Has ID @123
  test('test 2', async () => {}) // ❌ Missing required ID tag
})

// ✅ Valid with granularReporting: true
test.describe('suite', { tag: ['@team-frontend'] }, () => {
  test('test 1', { tag: ['@123'] }, async () => {}) // ✅ Has ID @123
  test('test 2', { tag: ['@456'] }, async () => {}) // ✅ Has ID @456
})
```

### Shared Paths

Use `sharedPaths` to ignore validation in specific directories:

```js
{
  sharedPaths: ['shared', 'common', 'utils']
}
```

## Exemption Behavior

When a literal string exclusion tag is present (like `@noid`), the entire tag
pool requirement becomes optional:

```ts
// This test would normally require an Issue ID tag
// But @noid exempts it from that requirement
test(
  'my test',
  {
    tag: ['@noid', '@team-frontend', '@user-service', '@api'],
  },
  async ({ page }) => {},
)
```

## Use Cases

### Project-Specific Tags

```js
{
  tagPools: [
    {
      name: 'Feature Area',
      pattern: '^@feature-',
    },
    {
      name: 'Test Type',
      pattern: '^@(unit|integration|e2e)$',
    },
  ]
}
```

### Issue Tracking Integration

```js
{
  tagPools: [
    {
      name: 'Ticket ID',
      pattern: '^@(jira|github)-\\w+$',
      exclude: ['@no-ticket'],
    },
  ]
}
```

### Environment-Specific Testing

```js
{
  tagPools: [
    {
      name: 'Environment',
      pattern: '^@env-(dev|staging|prod)$',
      exclude: ['@env-local'],
    },
    {
      name: 'Browser',
      pattern: '^@(chrome|firefox|safari)$',
    },
  ]
}
```

### Test Case Tracking with Granular Reporting

```js
{
  tagPools: [
    {
      name: 'Test Case ID',
      pattern: '^@tc-\\d+$',
      granularReporting: true, // Every test needs unique ID
      exclude: ['@no-tc']
    },
    {
      name: 'Priority',
      pattern: '^@(p0|p1|p2|p3)$',
      granularReporting: true // Every test needs priority
    },
    {
      name: 'Feature Area',
      pattern: '^@feature-\\w+$'
      // File-level is fine - whole suite can share feature area
    }
  ]
}
```

## When Not To Use

- If you don't need structured tag validation
- If your tests don't use tags
- If you prefer a more flexible, unstructured tagging approach

## Further Reading

- [Playwright Test Tags](https://playwright.dev/docs/test-annotations#tag-tests)
- [ESLint Configuration](https://eslint.org/docs/user-guide/configuring/)
