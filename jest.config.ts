module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: './test',
  snapshotFormat: {
    escapeString: true,
    printBasicPrototype: true,
  },
}
