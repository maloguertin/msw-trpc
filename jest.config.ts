module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom',
  rootDir: './test',
  snapshotFormat: {
    escapeString: true,
    printBasicPrototype: true,
  },
}
