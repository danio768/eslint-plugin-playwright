import { runTSRuleTester } from '../utils/rule-tester.js'
import requireTestTags from './require-test-tags.js'

// Example configuration with flexible tag pools
const exampleConfig = [
  {
    sharedPaths: ['shared'],
    tagPools: [
      {
        exclude: ['@noid'],
        name: 'Issue ID',
        pattern: '^@(\\d+|\\$\\{[^}]*id[^}]*\\})$',
      },
      {
        name: 'Team',
        pattern: '^@team-',
      },
      {
        exclude: [
          { flags: 'i', source: '^@team-' },
          '@noid',
          { flags: 'i', source: '^@(frontend|backend|api)$' },
          { flags: 'i', source: '^@\\d+$' },
          { flags: 'i', source: '^@\\$\\{[^}]*id[^}]*\\}$' },
        ],
        name: 'Component',
        pattern: '^@[a-z0-9_-]+$',
      },
      {
        name: 'Environment',
        pattern: '^@(frontend|backend|api)$',
      },
    ],
  },
]

runTSRuleTester('require-test-tags', requireTestTags, {
  invalid: [
    // Missing Issue ID tag across entire file
    {
      code: `
        test('my test', { 
          tag: ['@team-frontend', '@user-service', '@api'] 
        }, async ({ page }) => {})
      `,
      errors: [
        {
          data: { tagType: 'Issue ID' },
          messageId: 'missingTag',
        },
      ],
      filename: 'test.spec.ts',
      options: exampleConfig,
    },
    // Missing team tag across entire file
    {
      code: `
        test('my test', { 
          tag: ['@123', '@user-service', '@api'] 
        }, async ({ page }) => {})
      `,
      errors: [
        {
          data: { tagType: 'Team' },
          messageId: 'missingTag',
        },
      ],
      filename: 'test.spec.ts',
      options: exampleConfig,
    },
    // Missing component tag (api is environment, not component)
    {
      code: `
        test('my test', { 
          tag: ['@123', '@team-frontend', '@api'] 
        }, async ({ page }) => {})
      `,
      errors: [
        {
          data: { tagType: 'Component' },
          messageId: 'missingTag',
        },
      ],
      filename: 'test.spec.ts',
      options: exampleConfig,
    },
    // Missing environment tag across entire file
    {
      code: `
        test('my test', { 
          tag: ['@123', '@team-frontend', '@user-service'] 
        }, async ({ page }) => {})
      `,
      errors: [
        {
          data: { tagType: 'Environment' },
          messageId: 'missingTag',
        },
      ],
      filename: 'test.spec.ts',
      options: exampleConfig,
    },
    // Multiple missing tags across entire file
    {
      code: `
        test('my test', { 
          tag: ['@team-frontend'] 
        }, async ({ page }) => {})
      `,
      errors: [
        { data: { tagType: 'Issue ID' }, messageId: 'missingTag' },
        { data: { tagType: 'Component' }, messageId: 'missingTag' },
        { data: { tagType: 'Environment' }, messageId: 'missingTag' },
      ],
      filename: 'test.spec.ts',
      options: exampleConfig,
    },
    // No tags at all in entire file
    {
      code: "test('my test', async ({ page }) => {})",
      errors: [
        { data: { tagType: 'Issue ID' }, messageId: 'missingTag' },
        { data: { tagType: 'Team' }, messageId: 'missingTag' },
        { data: { tagType: 'Component' }, messageId: 'missingTag' },
        { data: { tagType: 'Environment' }, messageId: 'missingTag' },
      ],
      filename: 'test.spec.ts',
      options: exampleConfig,
    },
  ],
  valid: [
    // All required tags present in single test
    {
      code: `
        test('my test', { 
          tag: ['@123', '@team-frontend', '@user-service', '@api'] 
        }, async ({ page }) => {})
      `,
      filename: 'test.spec.ts',
      options: exampleConfig,
    },
    // All required tags present with dynamic Issue ID
    {
      code: `
        test('my test', { 
          tag: ['@\${caseData.issueId}', '@team-backend', '@order-service', '@backend'] 
        }, async ({ page }) => {})
      `,
      filename: 'test.spec.ts',
      options: exampleConfig,
    },
    // Exception for @noid (skips Issue ID requirement)
    {
      code: `
        test('my test', { 
          tag: ['@noid', '@team-frontend', '@user-service', '@api'] 
        }, async ({ page }) => {})
      `,
      filename: 'test.spec.ts',
      options: exampleConfig,
    },
    // Tags distributed across test.describe and test calls
    {
      code: `
        test.describe('user management', { 
          tag: ['@123', '@team-frontend'] 
        }, () => {
          test('create user', { 
            tag: ['@user-service', '@api'] 
          }, async ({ page }) => {})
          
          test('delete user', async ({ page }) => {})
        })
      `,
      filename: 'test.spec.ts',
      options: exampleConfig,
    },
    // Multiple test.describe blocks with distributed tags
    {
      code: `
        test.describe('auth tests', { 
          tag: ['@456', '@team-backend'] 
        }, () => {
          test('login', { tag: ['@auth-service'] }, async ({ page }) => {})
        })
        
        test.describe('api tests', { 
          tag: ['@backend'] 
        }, () => {
          test('api call', async ({ page }) => {})
        })
      `,
      filename: 'test.spec.ts',
      options: exampleConfig,
    },
    // Individual test without describe - still needs all required tags
    {
      code: `
        test('standalone test', { 
          tag: ['@789', '@team-frontend', '@user-service', '@api'] 
        }, async ({ page }) => {})
      `,
      filename: 'test.spec.ts',
      options: exampleConfig,
    },
    // Shared directory should be ignored
    {
      code: "test('my test', async ({ page }) => {})",
      filename: 'shared/test.spec.ts',
      options: exampleConfig,
    },
    // Non-spec files should be ignored
    {
      code: "test('my test', async ({ page }) => {})",
      filename: 'test.ts',
      options: exampleConfig,
    },
    // No configuration provided (no validation)
    {
      code: "test('my test', async ({ page }) => {})",
      filename: 'test.spec.ts',
    },
    // Tags distributed across test.describe and test should be valid
    {
      code: `
        test.describe('Feature Tests', { tag: ['@123', '@team-frontend', '@user-service'] }, () => {
          test('should work', { tag: ['@api'] }, async ({ page }) => {})
        })
      `,
      filename: 'test.spec.ts',
      options: exampleConfig,
    },
    // Template literal tags should work with reconstruction
    {
      code: `
        const data = { testCaseId: '123' }
        test.describe('Template Tags', { tag: ['@team-frontend', '@user-service'] }, () => {
          test('Template Test', { tag: [\`@\${data.testCaseId}\`, '@api'] }, async ({ page }) => {})
        })
      `,
      filename: 'test.spec.ts',
      options: exampleConfig,
    },
    // Mixed static and template literal tags
    {
      code: `
        test.describe('Mixed Tags', { tag: ['@456', '@team-backend'] }, () => {
          test('Mixed Test', { tag: [\`@order-service\`, '@api'] }, async ({ page }) => {})
        })
      `,
      filename: 'test.spec.ts',
      options: exampleConfig,
    },
    // Custom tag pools - only require Issue ID and priority
    {
      code: `
        test('my test', { 
          tag: ['@123', '@priority-high'] 
        }, async ({ page }) => {})
      `,
      filename: 'test.spec.ts',
      options: [
        {
          tagPools: [
            {
              name: 'Issue ID',
              pattern: '^@\\d+$',
            },
            {
              name: 'Priority',
              pattern: '^@priority-',
            },
          ],
        },
      ],
    },
  ],
})

// Test cases for granular reporting (per-test validation with inheritance)
const mixedGranularConfig = [
  {
    sharedPaths: ['shared'],
    tagPools: [
      {
        exclude: ['@noid'],
        name: 'Issue ID',
        pattern: '^@\\d+$',
        // File-level validation for Issue ID (default)
      },
      {
        name: 'Team',
        pattern: '^@team-',
        // File-level validation for Team (default)
      },
      {
        exclude: [
          '@team-frontend',
          '@team-backend',
          '@api',
          '@frontend',
          '@backend',
          '@noid',
          { source: '^@\\d+$' },
        ],
        granularReporting: true, // Per-test validation for Component
        name: 'Component',
        pattern: '^@[a-z0-9_-]+$',
      },
      {
        granularReporting: true, // Per-test validation for Environment
        name: 'Environment',
        pattern: '^@(frontend|backend|api)$',
      },
    ],
  },
]

runTSRuleTester(
  'require-test-tags (mixed granular reporting)',
  requireTestTags,
  {
    invalid: [
      // Component and Environment use granular reporting, Issue ID and Team use file-level
      {
        code: `
        test.describe('user management', { 
          tag: ['@123', '@team-frontend'] 
        }, () => {
          test('create user', { 
            tag: ['@user-service', '@api'] 
          }, async ({ page }) => {})
          
          test('delete user', async ({ page }) => {})
        })
      `,
        errors: [
          // Only granular pools (Component and Environment) report per-test errors
          // delete user inherits [@123, @team-frontend] but needs a Component tag (not excluded) and Environment tag
          {
            data: { tagType: 'Component', testTitle: 'delete user' },
            messageId: 'missingTagInTest',
          },
          {
            data: { tagType: 'Environment', testTitle: 'delete user' },
            messageId: 'missingTagInTest',
          },
          // Issue ID and Team pools would use file-level validation (no errors since they exist in file)
        ],
        filename: 'test.spec.ts',
        options: mixedGranularConfig,
      },
      // Debug test - Component pool should report error for @team-frontend inheritance
      {
        code: `
        test.describe('debug', { 
          tag: ['@team-frontend'] 
        }, () => {
          test('child test', async ({ page }) => {})
        })
      `,
        errors: [
          // File-level validation for Issue ID and Team
          {
            data: { tagType: 'Issue ID' },
            messageId: 'missingTag',
          },
          // Component should report granular error since @team-frontend is excluded
          {
            data: { tagType: 'Component', testTitle: 'child test' },
            messageId: 'missingTagInTest',
          },
          // Environment should report granular error
          {
            data: { tagType: 'Environment', testTitle: 'child test' },
            messageId: 'missingTagInTest',
          },
        ],
        filename: 'test.spec.ts',
        options: mixedGranularConfig,
      },
    ],
    valid: [
      // All tags properly inherited and distributed according to their validation mode
      {
        code: `
        test.describe('user management', { 
          tag: ['@123', '@team-frontend'] 
        }, () => {
          test('create user', { 
            tag: ['@user-service', '@api'] 
          }, async ({ page }) => {})
          
          test('delete user', { 
            tag: ['@user-service', '@api'] 
          }, async ({ page }) => {})
        })
      `,
        filename: 'test.spec.ts',
        options: mixedGranularConfig,
      },
      // File-level validation allows distribution across multiple tests for non-granular pools
      {
        code: `
        test.describe('auth tests', { 
          tag: ['@456'] // Issue ID available at file level
        }, () => {
          test('login', { tag: ['@auth-service', '@api'] }, async ({ page }) => {})
        })
        
        test.describe('other tests', { 
          tag: ['@team-backend'] // Team available at file level
        }, () => {
          test('logout', { tag: ['@auth-service', '@api'] }, async ({ page }) => {})
        })
      `,
        filename: 'test.spec.ts',
        options: mixedGranularConfig,
      },
    ],
  },
)
