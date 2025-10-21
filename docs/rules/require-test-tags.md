# Require Test Tags

Enforces that tests have required tags based on configurable tag pools.

## Rule Details

This rule validates that tests include tags from all required tag pools. Tag
pools are completely configurable, allowing you to define custom tag categories
with their own patterns and exclusions.

### Examples

````ts
// ❌ Incorrect - missing required tag types
test('my test', { tag: ['@team-frontend'] }, async ({ page }) => {})

# Require Test Tags

Enforces that test files have required tags based on configurable tag pools. Tags can be distributed across `test.describe` and `test` calls within the same file.

## Rule Details

This rule validates that each test file includes tags from all required tag pools. Tag pools are completely configurable, allowing you to define custom tag categories with their own patterns and exclusions.

**Important**: The rule checks for tag coverage across the entire file, not per individual test. Tags can be inherited from `test.describe` blocks or distributed across multiple `test` calls.

**Template Literal Support**: The rule supports both static string tags and template literals. Template literals with expressions are reconstructed with appropriate placeholders for pattern matching.

### Examples

```ts
// ❌ Incorrect - missing required tag types in the file
test('my test', { tag: ['@team-frontend'] }, async ({ page }) => {})
````

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
        tag: [`@${data.testCaseId}`, '@api'], // Reconstructed as @123456 for pattern matching
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

test( 'my test', { tag: ['@123', '@team-frontend', '@user-service', '@api'], },
async ({ page }) => {}, )

// ✅ Correct - exemption tag makes requirement optional test( 'my test', { tag:
['@noid', '@team-frontend', '@user-service', '@api'], }, async ({ page }) => {},
)

````

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
}
````

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
      exclude: ['@noid']
    },
    {
      name: 'Component',
      pattern: '^@[a-z0-9_-]+$',
      exclude: [
        { source: '^@team-', flags: 'i' },
        '@noid',
        { source: '^@(frontend|backend|api)$', flags: 'i' },
        { source: '^@\\d+$', flags: 'i' }
      ]
    },
    {
      name: 'Environment',
      pattern: '^@(frontend|backend|api)$'
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

**Note**: All defined tag pools are required. If you configure a tag pool, it
will be enforced for all tests.

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

## When Not To Use

- If you don't need structured tag validation
- If your tests don't use tags
- If you prefer a more flexible, unstructured tagging approach

## Further Reading

- [Playwright Test Tags](https://playwright.dev/docs/test-annotations#tag-tests)
- [ESLint Configuration](https://eslint.org/docs/user-guide/configuring/)
