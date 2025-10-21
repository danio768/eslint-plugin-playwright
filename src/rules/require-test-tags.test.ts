import { runTSRuleTester } from '../utils/rule-tester.js'
import requireTestTags from './require-test-tags.js'

// Example configuration with flexible tag pools
const exampleConfig = [{
  sharedPaths: ['shared'],
  tagPools: [
    {
      exclude: ['@noid'],
      name: 'Issue ID',
      pattern: '^@(\\d+|\\$\\{[^}]*id[^}]*\\})$'
    },
    {
      name: 'Team',
      pattern: '^@team-'
    },
    {
      exclude: [
        { flags: 'i', source: '^@team-' },
        '@noid',
        { flags: 'i', source: '^@(frontend|backend|api)$' },
        { flags: 'i', source: '^@\\d+$' },
        { flags: 'i', source: '^@\\$\\{[^}]*id[^}]*\\}$' }
      ],
      name: 'Component',
      pattern: '^@[a-z0-9_-]+$'
    },
    {
      name: 'Environment',
      pattern: '^@(frontend|backend|api)$'
    }
  ]
}]

runTSRuleTester('require-test-tags', requireTestTags, {
  invalid: [
    // Missing Issue ID tag
    {
      code: `
        test('my test', { 
          tag: ['@team-frontend', '@user-service', '@api'] 
        }, async ({ page }) => {})
      `,
      errors: [
        { data: { tagType: 'Issue ID' }, messageId: 'missingTag' },
      ],
      filename: 'test.spec.ts',
      options: exampleConfig,
    },
    // Missing team tag
    {
      code: `
        test('my test', { 
          tag: ['@123', '@user-service', '@api'] 
        }, async ({ page }) => {})
      `,
      errors: [{ data: { tagType: 'Team' }, messageId: 'missingTag' }],
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
      errors: [{ data: { tagType: 'Component' }, messageId: 'missingTag' }],
      filename: 'test.spec.ts',
      options: exampleConfig,
    },
    // Missing environment tag
    {
      code: `
        test('my test', { 
          tag: ['@123', '@team-frontend', '@user-service'] 
        }, async ({ page }) => {})
      `,
      errors: [{ data: { tagType: 'Environment' }, messageId: 'missingTag' }],
      filename: 'test.spec.ts',
      options: exampleConfig,
    },
    // Multiple missing tags
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
      options: exampleConfig,
    },
    // Single tag format missing other required tags
    {
      code: "test('my test', { tag: '@123' }, async ({ page }) => {})",
      errors: [
        { data: { tagType: 'Team' }, messageId: 'missingTag' },
        { data: { tagType: 'Component' }, messageId: 'missingTag' },
        { data: { tagType: 'Environment' }, messageId: 'missingTag' },
      ],
      filename: 'test.spec.ts',
      options: exampleConfig,
    },
  ],
  valid: [
    // All required tags present
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
    // Custom tag pools - only require Issue ID and priority
    {
      code: `
        test('my test', { 
          tag: ['@123', '@priority-high'] 
        }, async ({ page }) => {})
      `,
      filename: 'test.spec.ts',
      options: [{
        tagPools: [
          {
            name: 'Issue ID',
            pattern: '^@\\d+$'
          },
          {
            name: 'Priority',
            pattern: '^@priority-'
          }
        ]
      }],
    },
  ],
})