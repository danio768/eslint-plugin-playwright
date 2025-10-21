import { runTSRuleTester } from '../utils/rule-tester.js'
import rule from './no-duplicate-tags.js'

// Test configuration with explicit project root to limit scanning scope
const testOptions = [{
  projectRoot: './src/rules'  // Limit to current directory for testing
}]

runTSRuleTester('no-duplicate-tags', rule, {
  invalid: [
    // Duplicate tags within the same file
    {
      code: `
        test('first test', { tag: '@123' }, async ({ page }) => {})
        test('second test', { tag: '@123' }, async ({ page }) => {})
      `,
      errors: [
        { data: { location: ' in this file', tag: '@123' }, messageId: 'duplicateTag' },
      ],
      filename: 'test.spec.ts',
      options: testOptions,
    },
    // Duplicate tags in array format
    {
      code: `
        test('test one', { tag: ['@456', '@789'] }, async ({ page }) => {})
        test('test two', { tag: '@456' }, async ({ page }) => {})
      `,
      errors: [
        { data: { location: ' in this file', tag: '@456' }, messageId: 'duplicateTag' },
      ],
      filename: 'test.spec.ts',
      options: testOptions,
    },
    // Multiple duplicates
    {
      code: `
        test('test a', { tag: '@100' }, async ({ page }) => {})
        test('test b', { tag: '@200' }, async ({ page }) => {})
        test('test c', { tag: '@100' }, async ({ page }) => {})
        test('test d', { tag: '@200' }, async ({ page }) => {})
      `,
      errors: [
        { data: { location: ' in this file', tag: '@100' }, messageId: 'duplicateTag' },
        { data: { location: ' in this file', tag: '@200' }, messageId: 'duplicateTag' },
      ],
      filename: 'test.spec.ts',
      options: testOptions,
    },
  ],
  valid: [
    // No tags
    {
      code: "test('my test', async ({ page }) => {})",
      filename: 'test.spec.ts',
      options: testOptions,
    },
    // Unique numeric tags
    {
      code: `
        test('test one', { tag: '@123' }, async ({ page }) => {})
        test('test two', { tag: '@456' }, async ({ page }) => {})
      `,
      filename: 'test.spec.ts',
      options: testOptions,
    },
    // Mixed tags (only @number tags are checked for duplicates)
    {
      code: `
        test('test one', { tag: ['@123', '@team-frontend'] }, async ({ page }) => {})
        test('test two', { tag: ['@456', '@team-frontend'] }, async ({ page }) => {})
      `,
      filename: 'test.spec.ts',
      options: testOptions,
    },
    // Non-spec files should be ignored
    {
      code: `
        test('test one', { tag: '@123' }, async ({ page }) => {})
        test('test two', { tag: '@123' }, async ({ page }) => {})
      `,
      filename: 'test.ts',
      options: testOptions,
    },
    // Non-numeric tags (should not trigger duplicate detection)
    {
      code: `
        test('test one', { tag: '@team-frontend' }, async ({ page }) => {})
        test('test two', { tag: '@team-frontend' }, async ({ page }) => {})
      `,
      filename: 'test.spec.ts',
      options: testOptions,
    },
    // Dynamic tags
    {
      code: `
        test('test one', { tag: '@\${caseData.testCaseId}' }, async ({ page }) => {})
        test('test two', { tag: '@\${caseData.testCaseId}' }, async ({ page }) => {})
      `,
      filename: 'test.spec.ts',
      options: testOptions,
    },
    // Array with unique numeric tags
    {
      code: `
        test('complex test', { 
          tag: ['@123', '@team-frontend', '@user-service'] 
        }, async ({ page }) => {})
        test('another test', { 
          tag: ['@456', '@team-backend', '@order-service'] 
        }, async ({ page }) => {})
      `,
      filename: 'test.spec.ts',
      options: testOptions,
    },
  ],
})