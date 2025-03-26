/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
    transform: { '^.+\\.ts?$': 'ts-jest' },
    testEnvironment: 'node',
    testRegex: '/__tests__/.*\\.(test|spec)?\\.(ts|tsx)$',
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    testTimeout: 12000,
}
