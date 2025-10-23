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
        "tagPools": [
          {
            "name": "ID",
            "pattern": "^@(\\d+|\\$\\{[^}]*testCaseId[^}]*\\})$",
            "exclude": ["@noid"],
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

#### Advanced Configuration with Complex Excludes

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
        { source: '^@team-', flags: 'i' }, // Case-insensitive team tags
        '@noid',
        { source: '^@(frontend|backend|api)$', flags: 'i' }, // Environment tags
        { source: '^@\\d+$' }, // Numeric tags (case-sensitive)
        { source: '^@\\$\\{[^}]*id[^}]*\\}$' } // Template literal IDs
      ],
      granularReporting: true // Each test must have component tag
    },
    {
      name: 'Environment',
      pattern: '^@(frontend|backend|api)$'
      // No granularReporting - file-level validation is sufficient
    }
  ],
  sharedPaths: ['shared', 'common', 'utils']
}
```

#### Regex Pattern Excludes

```js
{
  tagPools: [
    {
      name: 'Component',
      pattern: '^@[a-z0-9_-]+$',
      exclude: [
        { source: '^@team-', flags: 'i' }, // Case-insensitive: matches @team-, @TEAM-, etc.
        { source: '^@\\d+$' }, // Case-sensitive: matches @123, @456, etc.
        { source: '^@issue-\\d+$', flags: 'i' } // Case-insensitive: matches @issue-123, @ISSUE-456
      ]
    },
    {
      name: 'Priority',
      pattern: '^@(p0|p1|p2|p3)$',
      exclude: [
        { source: '^@exempt-.*', flags: 'i' }, // Any tag starting with @exempt-
        '@no-priority' // Literal string exclusion
      ]
    }
  ]
}
```

### Tag Pool Options

- **`name`** (string): Display name used in error messages
- **`pattern`** (string | object): Regex pattern to match tags
  - String: `"^@team-"`
  - Object: `{ source: "^@team-", flags: "i" }`
- **`exclude`** (array, optional): Patterns or literals to exclude validation
  - String literals: `["@noid"]` - Makes the requirement optional when present
  - Regex patterns: `[{ source: "^@\\d+$", flags: "i" }]` - Excludes tags matching pattern from validation
  - Mixed types: `["@skip", { source: "^@temp-", flags: "i" }]` - Combines literal and pattern excludes
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

## Exclude Functionality

### String Literal Excludes
When a literal string exclude tag is present, the entire tag pool requirement becomes optional:

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

### Regex Pattern Excludes
Exclude tags matching specific patterns from validation:

```ts
// With exclude: [{ source: '^@team-', flags: 'i' }]
// These tests skip Component validation because they have team tags
test('my test', { tag: ['@team-frontend', '@api'] }, async ({ page }) => {}) // ✅ Component skipped
test('my test', { tag: ['@TEAM-BACKEND', '@api'] }, async ({ page }) => {}) // ✅ Component skipped (case-insensitive)
test('my test', { tag: ['@other-tag', '@api'] }, async ({ page }) => {}) // ❌ Component required
```

### Exclude Inheritance
In granular reporting mode, exclude tags are inherited from parent `test.describe` blocks:

```ts
// With granularReporting: true and exclude: ['@skip-component']
test.describe('suite', { tag: ['@skip-component', '@team-frontend'] }, () => {
  test('child test', async ({ page }) => {}) // ✅ Component requirement skipped (inherited)
})
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

### Complex Exclude Scenarios

```js
{
  tagPools: [
    {
      name: 'Test Case ID',
      pattern: '^@tc-\\d+$',
      exclude: [
        '@no-tc',
        { source: '^@legacy-', flags: 'i' },
        { source: '^@temp-\\w+$' }
      ],
      granularReporting: true
    }
  ]
}
```

```ts
// These tests skip Test Case ID validation:
test('legacy test', { tag: ['@legacy-old'] }, async ({ page }) => {}) // ✅ Excluded by regex
test('temp test', { tag: ['@temp-dev'] }, async ({ page }) => {}) // ✅ Excluded by regex  
test('no id test', { tag: ['@no-tc'] }, async ({ page }) => {}) // ✅ Excluded by literal
test('normal test', { tag: ['@other'] }, async ({ page }) => {}) // ❌ Requires @tc-123
```

### Environment-Specific Testing with Smart Excludes

```js
{
  tagPools: [
    {
      name: 'Environment',
      pattern: '^@env-(dev|staging|prod)$',
      exclude: [
        '@env-local',
        { source: '^@skip-env.*', flags: 'i' }
      ],
    },
    {
      name: 'Browser',
      pattern: '^@(chrome|firefox|safari)$',
      exclude: [
        { source: '^@mobile-', flags: 'i' },
        '@headless-only'
      ]
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

## Real-World Examples

### Enterprise Configuration
A comprehensive setup for large teams with multiple tag requirements:

```js
{
  tagPools: [
    {
      name: 'Test Case ID',
      pattern: '^@(tc-\\d+|\\$\\{[^}]*id[^}]*\\})$',
      exclude: ['@no-testcase'],
      granularReporting: true // Every test needs unique ID
    },
    {
      name: 'Priority',
      pattern: '^@(p0|p1|p2|p3)$',
      exclude: [
        { source: '^@exploratory', flags: 'i' },
        '@manual-only'
      ],
      granularReporting: true // Every test needs priority
    },
    {
      name: 'Team',
      pattern: '^@team-(frontend|backend|qa|devops)$',
      exclude: ['@cross-team']
      // File-level validation - whole suite can share team
    },
    {
      name: 'Feature Area',
      pattern: '^@feature-[a-z0-9-]+$',
      exclude: [
        { source: '^@infrastructure', flags: 'i' },
        { source: '^@team-', flags: 'i' }
      ]
      // File-level validation
    },
    {
      name: 'Test Type',
      pattern: '^@(unit|integration|e2e|api)$',
      exclude: ['@mixed-type']
    }
  ],
  sharedPaths: ['shared', 'utils', 'fixtures']
}
```

### CI/CD Pipeline Integration
Perfect for automated test execution and reporting:

```ts
// ✅ Comprehensive test with all required tags
test(
  'user registration flow',
  {
    tag: [
      '@tc-1234', // Test Case ID (granular)
      '@p1', // Priority (granular)
      '@team-frontend', // Team (file-level)
      '@feature-auth', // Feature Area (file-level)
      '@e2e' // Test Type (file-level)
    ],
  },
  async ({ page }) => {
    // Test implementation
  },
)

// ✅ Template literal support for dynamic IDs
const testData = { caseId: '5678' }
test(
  'payment processing',
  {
    tag: [
      `@tc-${testData.caseId}`, // Dynamic Test Case ID
      '@p0', // Critical priority
      '@feature-payment',
      '@api'
    ],
  },
  async ({ page }) => {
    // Test implementation
  },
)

// ✅ Excluded test that skips certain requirements
test(
  'exploratory security test',
  {
    tag: [
      '@exploratory', // Skips priority requirement
      '@no-testcase', // Skips test case ID requirement
      '@team-qa',
      '@feature-security',
      '@manual-only'
    ],
  },
  async ({ page }) => {
    // Ad-hoc security testing
  },
)
```

### Migration-Friendly Configuration
Gradual adoption with smart excludes:

```js
{
  tagPools: [
    {
      name: 'Modern Test ID',
      pattern: '^@test-\\d{4}$',
      exclude: [
        { source: '^@legacy-', flags: 'i' }, // Exclude legacy tests
        { source: '^@old-\\d+$' }, // Exclude old numbering
        '@migration-pending'
      ],
      granularReporting: true
    },
    {
      name: 'Team Assignment',
      pattern: '^@owner-(alpha|beta|gamma)$',
      exclude: [
        '@unassigned',
        { source: '^@legacy-team-', flags: 'i' }
      ]
    }
  ]
}
```

## When Not To Use

- If you don't need structured tag validation
- If your tests don't use tags  
- If you prefer a more flexible, unstructured tagging approach
- If you're just starting with Playwright and want to keep things simple initially

## Further Reading

- [Playwright Test Tags](https://playwright.dev/docs/test-annotations#tag-tests)
- [ESLint Configuration](https://eslint.org/docs/user-guide/configuring/)
