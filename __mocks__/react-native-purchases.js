module.exports = {
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    getCustomerInfo: jest.fn().mockResolvedValue({ entitlements: { active: {} } }),
    getOfferings: jest.fn().mockResolvedValue({ all: {}, current: null }),
    purchasePackage: jest.fn(),
    logIn: jest.fn(),
    logOut: jest.fn(),
    close: jest.fn(),
    isAnonymous: jest.fn().mockReturnValue(true),
    getAppUserId: jest.fn().mockReturnValue('test-user'),
  },
  LOG_LEVEL: { VERBOSE: 'VERBOSE', DEBUG: 'DEBUG', INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR', SILENT: 'SILENT' },
  PURCHASES_ERROR_CODE: { UnknownError: 'UnknownError', UserCancelledError: 'UserCancelledError' },
}
