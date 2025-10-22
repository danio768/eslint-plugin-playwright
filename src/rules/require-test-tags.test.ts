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
          // Component validation should be skipped because @team-frontend is in exclude list
          // Only Environment granular error should remain
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
          // Component validation should be skipped because @team-frontend is in exclude list
          // Only Environment granular error should remain
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

// Test cases for full granular reporting (all pools use per-test validation)
const fullGranularConfig = [
  {
    sharedPaths: ['shared'],
    tagPools: [
      {
        exclude: ['@noid'],
        granularReporting: true,
        name: 'Issue ID',
        pattern: '^@\\d+$',
      },
      {
        granularReporting: true,
        name: 'Team',
        pattern: '^@team-',
      },
      {
        exclude: ['@team-frontend', '@api'],
        granularReporting: true,
        name: 'Component',
        pattern: '^@[a-z0-9_-]+$',
      },
      {
        granularReporting: true,
        name: 'Environment',
        pattern: '^@(frontend|backend|api)$',
      },
    ],
  },
]

runTSRuleTester(
  'require-test-tags (full granular reporting)',
  requireTestTags,
  {
    invalid: [
      // All pools use granular reporting - each test must have all required tags
      {
        code: `
        test.describe('user management', { 
          tag: ['@123', '@team-frontend'] 
        }, () => {
          test('create user', { 
            tag: ['@user-service'] 
          }, async ({ page }) => {})
        })
      `,
        errors: [
          // Issue ID inherited, Team inherited, Component excluded, but Environment missing
          {
            data: { tagType: 'Environment', testTitle: 'create user' },
            messageId: 'missingTagInTest',
          },
        ],
        filename: 'test.spec.ts',
        options: fullGranularConfig,
      },
      // Test with no inheritance - must provide all tags
      {
        code: `
        test('standalone test', { 
          tag: ['@user-service'] 
        }, async ({ page }) => {})
      `,
        errors: [
          {
            data: { tagType: 'Issue ID', testTitle: 'standalone test' },
            messageId: 'missingTagInTest',
          },
          {
            data: { tagType: 'Team', testTitle: 'standalone test' },
            messageId: 'missingTagInTest',
          },
          {
            data: { tagType: 'Environment', testTitle: 'standalone test' },
            messageId: 'missingTagInTest',
          },
        ],
        filename: 'test.spec.ts',
        options: fullGranularConfig,
      },
    ],
    valid: [
      // All required tags properly distributed with exclusions working
      {
        code: `
        test.describe('user management', { 
          tag: ['@123', '@team-frontend'] // Component excluded due to @team-frontend
        }, () => {
          test('create user', { 
            tag: ['@api'] // Environment provided
          }, async ({ page }) => {})
        })
      `,
        filename: 'test.spec.ts',
        options: fullGranularConfig,
      },
      // Exemption tag skips validation only for Issue ID pool
      {
        code: `
        test('exempt test', { 
          tag: ['@noid', '@team-frontend', '@api'] // Issue ID excluded, other requirements satisfied
        }, async ({ page }) => {})
      `,
        filename: 'test.spec.ts',
        options: fullGranularConfig,
      },
    ],
  },
)

// Test cases for regex pattern excludes
const regexExcludeConfig = [
  {
    tagPools: [
      {
        exclude: [
          { flags: 'i', source: '^@team-' }, // Case-insensitive team exclusion
          { source: '^@\\d+$' }, // Numeric ID exclusion
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

runTSRuleTester(
  'require-test-tags (regex excludes)',
  requireTestTags,
  {
    invalid: [
      // Should require Environment only (Component satisfied by @other-tag)
      {
        code: `
        test('my test', { 
          tag: ['@other-tag'] 
        }, async ({ page }) => {})
      `,
        errors: [
          { data: { tagType: 'Environment' }, messageId: 'missingTag' },
        ],
        filename: 'test.spec.ts',
        options: regexExcludeConfig,
      },
    ],
    valid: [
      // Regex exclude should skip Component validation for team tags
      {
        code: `
        test('my test', { 
          tag: ['@team-frontend', '@api'] // Component excluded, Environment satisfied
        }, async ({ page }) => {})
      `,
        filename: 'test.spec.ts',
        options: regexExcludeConfig,
      },
      // Case-insensitive team exclusion
      {
        code: `
        test('my test', { 
          tag: ['@TEAM-BACKEND', '@api'] // Component excluded (case-insensitive), Environment satisfied
        }, async ({ page }) => {})
      `,
        filename: 'test.spec.ts',
        options: regexExcludeConfig,
      },
      // Numeric ID exclusion
      {
        code: `
        test('my test', { 
          tag: ['@123', '@api'] // Component excluded by numeric pattern, Environment satisfied
        }, async ({ page }) => {})
      `,
        filename: 'test.spec.ts',
        options: regexExcludeConfig,
      },
    ],
  },
)

// Test cases for template literal excludes and complex scenarios
const templateExcludeConfig = [
  {
    tagPools: [
      {
        exclude: ['@noid'],
        name: 'Issue ID',
        pattern: '^@(\\d+|\\$\\{[^}]*id[^}]*\\})$',
      },
      {
        exclude: ['@component-skip'],
        granularReporting: true,
        name: 'Component',
        pattern: '^@[a-z0-9_-]+$',
      },
    ],
  },
]

runTSRuleTester(
  'require-test-tags (template literal excludes)',
  requireTestTags,
  {
    invalid: [
      // Only Issue ID provided, no Component tag
      {
        code: `
        test('my test', async ({ page }) => {})
      `,
        errors: [
          {
            data: { tagType: 'Issue ID' },
            messageId: 'missingTag', // File-level validation
          },
          {
            data: { tagType: 'Component', testTitle: 'my test' },
            messageId: 'missingTagInTest', // Granular validation
          },
        ],
        filename: 'test.spec.ts',
        options: templateExcludeConfig,
      },
    ],
    valid: [
      // Template literal with proper id variable should work
      {
        code: `
        const data = { issueId: '123' }
        test('my test', { 
          tag: [\`@\${data.issueId}\`, '@user-service'] // Template matches pattern, satisfies both pools
        }, async ({ page }) => {})
      `,
        filename: 'test.spec.ts',
        options: templateExcludeConfig,
      },
      // Exemption tag in template literal
      {
        code: `
        test('my test', { 
          tag: ['@noid'] // Issue ID excluded
        }, async ({ page }) => {})
      `,
        filename: 'test.spec.ts',
        options: templateExcludeConfig,
      },
      // Component exclusion with granular reporting
      {
        code: `
        test('my test', { 
          tag: ['@123', '@component-skip'] // Component excluded for this test
        }, async ({ page }) => {})
      `,
        filename: 'test.spec.ts',
        options: templateExcludeConfig,
      },
      // Template literal Issue ID
      {
        code: `
        const data = { testId: '456' }
        test('my test', { 
          tag: [\`@\${data.testId}\`, '@user-service'] 
        }, async ({ page }) => {})
      `,
        filename: 'test.spec.ts',
        options: templateExcludeConfig,
      },
    ],
  },
)
