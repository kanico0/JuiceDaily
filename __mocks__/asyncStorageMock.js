// Mock AsyncStorage for Jest tests
module.exports = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
  mergeItem: async () => {},
  clear: async () => {},
  getAllKeys: async () => [],
  flushGetRequests: () => {},
  multiGet: async () => [],
  multiSet: async () => {},
  multiRemove: async () => {},
  multiMerge: async () => {},
}
