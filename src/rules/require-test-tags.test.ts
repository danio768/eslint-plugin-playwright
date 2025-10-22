import { runTSRuleTester } from '../utils/rule-tester.js'
import requireTestTags from './require-test-tags.js'

// Base configuration used across multiple test scenarios
const baseConfig = [
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

// Core functionality tests - basic file-level validation
runTSRuleTester('require-test-tags (core functionality)', requireTestTags, {
  invalid: [
    // Single missing tag per test to avoid redundancy
    {
      code: `test('my test', { tag: ['@team-frontend', '@user-service', '@api'] }, async ({ page }) => {})`,
      errors: [{ data: { tagType: 'Issue ID' }, messageId: 'missingTag' }],
      filename: 'test.spec.ts',
      options: baseConfig,
    },
    {
      code: `test('my test', { tag: ['@123', '@user-service', '@api'] }, async ({ page }) => {})`,
      errors: [{ data: { tagType: 'Team' }, messageId: 'missingTag' }],
      filename: 'test.spec.ts',
      options: baseConfig,
    },
    {
      code: `test('my test', { tag: ['@123', '@team-frontend', '@user-service'] }, async ({ page }) => {})`,
      errors: [{ data: { tagType: 'Environment' }, messageId: 'missingTag' }],
      filename: 'test.spec.ts',
      options: baseConfig,
    },
    // Multiple missing tags
    {
      code: `test('my test', { tag: ['@team-frontend'] }, async ({ page }) => {})`,
      errors: [
        { data: { tagType: 'Issue ID' }, messageId: 'missingTag' },
        { data: { tagType: 'Environment' }, messageId: 'missingTag' },
      ],
      filename: 'test.spec.ts',
      options: baseConfig,
    },
    // No tags at all
    {
      code: "test('my test', async ({ page }) => {})",
      errors: [
        { data: { tagType: 'Issue ID' }, messageId: 'missingTag' },
        { data: { tagType: 'Team' }, messageId: 'missingTag' },
        { data: { tagType: 'Component' }, messageId: 'missingTag' },
        { data: { tagType: 'Environment' }, messageId: 'missingTag' },
      ],
      filename: 'test.spec.ts',
      options: baseConfig,
    },
  ],
  valid: [
    // All required tags present
    {
      code: `test('my test', { tag: ['@123', '@team-frontend', '@user-service', '@api'] }, async ({ page }) => {})`,
      filename: 'test.spec.ts',
      options: baseConfig,
    },
    // Template literal tags
    {
      code: `test('my test', { tag: ['@\${caseData.issueId}', '@team-backend', '@order-service', '@backend'] }, async ({ page }) => {})`,
      filename: 'test.spec.ts',
      options: baseConfig,
    },
    // Exclude functionality
    {
      code: `test('my test', { tag: ['@noid', '@team-frontend', '@user-service', '@api'] }, async ({ page }) => {})`,
      filename: 'test.spec.ts',
      options: baseConfig,
    },
    // Tag inheritance across describe blocks
    {
      code: `
        test.describe('user management', { tag: ['@123', '@team-frontend'] }, () => {
          test('create user', { tag: ['@user-service', '@api'] }, async ({ page }) => {})
          test('delete user', async ({ page }) => {})
        })
      `,
      filename: 'test.spec.ts',
      options: baseConfig,
    },
    // File/directory exclusions
    {
      code: "test('my test', async ({ page }) => {})",
      filename: 'shared/test.spec.ts',
      options: baseConfig,
    },
    {
      code: "test('my test', async ({ page }) => {})",
      filename: 'test.ts',
      options: baseConfig,
    },
    // No configuration
    {
      code: "test('my test', async ({ page }) => {})",
      filename: 'test.spec.ts',
    },
  ],
})

// Granular reporting tests - mixed and full validation modes
const granularConfigs = {
  full: [
    {
      sharedPaths: ['shared'],
      tagPools: [
        { exclude: ['@noid'], granularReporting: true, name: 'Issue ID', pattern: '^@\\d+$' },
        { granularReporting: true, name: 'Team', pattern: '^@team-' },
        { exclude: ['@team-frontend', '@api'], granularReporting: true, name: 'Component', pattern: '^@[a-z0-9_-]+$' },
        { granularReporting: true, name: 'Environment', pattern: '^@(frontend|backend|api)$' },
      ],
    },
  ],
  mixed: [
    {
      sharedPaths: ['shared'],
      tagPools: [
        { exclude: ['@noid'], name: 'Issue ID', pattern: '^@\\d+$' },
        { name: 'Team', pattern: '^@team-' },
        {
          exclude: ['@team-frontend', '@team-backend', '@api', '@frontend', '@backend', '@noid', { source: '^@\\d+$' }],
          granularReporting: true,
          name: 'Component',
          pattern: '^@[a-z0-9_-]+$',
        },
        { granularReporting: true, name: 'Environment', pattern: '^@(frontend|backend|api)$' },
      ],
    },
  ],
}

runTSRuleTester('require-test-tags (granular reporting)', requireTestTags, {
  invalid: [
    // Mixed granular: granular pools report per-test, file-level pools report per-file
    {
      code: `
        test.describe('user management', { tag: ['@123', '@team-frontend'] }, () => {
          test('delete user', async ({ page }) => {})
        })
      `,
      errors: [{ data: { tagType: 'Environment', testTitle: 'delete user' }, messageId: 'missingTagInTest' }],
      filename: 'test.spec.ts',
      options: granularConfigs.mixed,
    },
    // Full granular: all pools require tags per-test
    {
      code: `
        test('standalone test', { tag: ['@user-service'] }, async ({ page }) => {})
      `,
      errors: [
        { data: { tagType: 'Issue ID', testTitle: 'standalone test' }, messageId: 'missingTagInTest' },
        { data: { tagType: 'Team', testTitle: 'standalone test' }, messageId: 'missingTagInTest' },
        { data: { tagType: 'Environment', testTitle: 'standalone test' }, messageId: 'missingTagInTest' },
      ],
      filename: 'test.spec.ts',
      options: granularConfigs.full,
    },
  ],
  valid: [
    // Mixed granular: file-level tags for non-granular pools
    {
      code: `
        test.describe('auth tests', { tag: ['@456'] }, () => {
          test('login', { tag: ['@auth-service', '@api'] }, async ({ page }) => {})
        })
        test.describe('other tests', { tag: ['@team-backend'] }, () => {
          test('logout', { tag: ['@auth-service', '@api'] }, async ({ page }) => {})
        })
      `,
      filename: 'test.spec.ts',
      options: granularConfigs.mixed,
    },
    // Full granular: exclude tag works properly
    {
      code: `
        test('exempt test', { tag: ['@noid', '@team-frontend', '@api'] }, async ({ page }) => {})
      `,
      filename: 'test.spec.ts',
      options: granularConfigs.full,
    },
  ],
})

// Exclude functionality tests - string excludes, regex excludes, and inheritance
const excludeConfigs = {
  complex: [
    {
      tagPools: [
        {
          exclude: ['@skip-validation', { flags: 'i', source: '^@temp-' }, { source: '^@issue-\\d+$' }],
          granularReporting: true,
          name: 'Required Tag',
          pattern: '^@[a-z0-9_-]+$',
        },
        { exclude: [{ flags: 'i', source: '^@exempt-.*' }, '@no-env'], name: 'Environment', pattern: '^@(prod|staging|dev)$' },
      ],
    },
  ],
  inheritance: [
    {
      tagPools: [
        { exclude: ['@skip-component', { source: '^@legacy-' }], granularReporting: true, name: 'Component', pattern: '^@[a-z0-9_-]+$' },
        { exclude: ['@skip-team'], name: 'Team', pattern: '^@team-' },
      ],
    },
  ],
  regex: [
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
        { name: 'Environment', pattern: '^@(frontend|backend|api)$' },
      ],
    },
  ],
  templateLiteral: [
    {
      tagPools: [
        { exclude: ['@noid'], name: 'Issue ID', pattern: '^@(\\d+|\\$\\{[^}]*id[^}]*\\})$' },
        { exclude: ['@component-skip'], granularReporting: true, name: 'Component', pattern: '^@[a-z0-9_-]+$' },
      ],
    },
  ],
}

runTSRuleTester('require-test-tags (exclude functionality)', requireTestTags, {
  invalid: [
    // Basic regex exclude failure
    {
      code: `test('my test', { tag: ['@other-tag'] }, async ({ page }) => {})`,
      errors: [{ data: { tagType: 'Environment' }, messageId: 'missingTag' }],
      filename: 'test.spec.ts',
      options: excludeConfigs.regex,
    },
    // Complex exclude - no excluded tags should validate normally
    {
      code: `test('my test', { tag: ['@other-tag'] }, async ({ page }) => {})`,
      errors: [{ data: { tagType: 'Environment' }, messageId: 'missingTag' }],
      filename: 'test.spec.ts',
      options: excludeConfigs.complex,
    },
    // Inheritance - file-level validation fails
    {
      code: `test('standalone test', { tag: ['@user-service'] }, async ({ page }) => {})`,
      errors: [{ data: { tagType: 'Team' }, messageId: 'missingTag' }],
      filename: 'test.spec.ts',
      options: excludeConfigs.inheritance,
    },
    // Template literal - both pools missing
    {
      code: `test('my test', async ({ page }) => {})`,
      errors: [
        { data: { tagType: 'Issue ID' }, messageId: 'missingTag' },
        { data: { tagType: 'Component', testTitle: 'my test' }, messageId: 'missingTagInTest' },
      ],
      filename: 'test.spec.ts',
      options: excludeConfigs.templateLiteral,
    },
  ],
  valid: [
    // Regex excludes - case insensitive team, case sensitive numeric
    {
      code: `test('my test', { tag: ['@TEAM-BACKEND', '@api'] }, async ({ page }) => {})`,
      filename: 'test.spec.ts',
      options: excludeConfigs.regex,
    },
    {
      code: `test('my test', { tag: ['@123', '@api'] }, async ({ page }) => {})`,
      filename: 'test.spec.ts',
      options: excludeConfigs.regex,
    },
    // Complex excludes - multiple patterns and types
    {
      code: `test('my test', { tag: ['@skip-validation', '@EXEMPT-test'] }, async ({ page }) => {})`,
      filename: 'test.spec.ts',
      options: excludeConfigs.complex,
    },
    // Inheritance - exclude from parent works
    {
      code: `
        test.describe('suite', { tag: ['@skip-component', '@team-frontend'] }, () => {
          test('child test', async ({ page }) => {})
        })
      `,
      filename: 'test.spec.ts',
      options: excludeConfigs.inheritance,
    },
    // Template literals with proper patterns
    {
      code: `
        const data = { issueId: '123' }
        test('my test', { tag: [\`@\${data.issueId}\`, '@user-service'] }, async ({ page }) => {})
      `,
      filename: 'test.spec.ts',
      options: excludeConfigs.templateLiteral,
    },
    // Custom configuration example
    {
      code: `test('my test', { tag: ['@123', '@priority-high'] }, async ({ page }) => {})`,
      filename: 'test.spec.ts',
      options: [
        {
          tagPools: [
            { name: 'Issue ID', pattern: '^@\\d+$' },
            { name: 'Priority', pattern: '^@priority-' },
          ],
        },
      ],
    },
  ],
})
