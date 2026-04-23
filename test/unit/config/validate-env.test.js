'use strict';

// Tests for src/config/validate-env.js
// We must manipulate process.env and mock process.exit since validate() calls exit(1) on failure.

describe('validate-env', () => {
  const ORIGINAL_ENV = { ...process.env };

  // Capture and restore process.exit
  let exitMock;
  let consoleErrorMock;

  beforeEach(() => {
    exitMock = vi.spyOn(process, 'exit').mockImplementation(() => {});
    consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore env to original state
    for (const key of Object.keys(process.env)) {
      if (!(key in ORIGINAL_ENV)) delete process.env[key];
    }
    Object.assign(process.env, ORIGINAL_ENV);
    vi.restoreAllMocks();
    // Clear module cache so each test gets a fresh require
    vi.resetModules();
  });

  const runValidate = () => {
    // Reset module cache so process.env changes take effect
    vi.resetModules();
    const { validate } = require('../../../src/config/validate-env');
    validate();
  };

  it('passes when all required vars are set correctly', () => {
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.DB_NAME = 'test.db';
    runValidate();
    expect(exitMock).not.toHaveBeenCalled();
  });

  it('calls process.exit(1) when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;
    process.env.DB_NAME = 'test.db';
    runValidate();
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('calls process.exit(1) when JWT_SECRET is too short (< 32 chars)', () => {
    process.env.JWT_SECRET = 'tooshort';
    process.env.DB_NAME = 'test.db';
    runValidate();
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('calls process.exit(1) when DB_NAME is missing', () => {
    process.env.JWT_SECRET = 'a'.repeat(32);
    delete process.env.DB_NAME;
    runValidate();
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('calls process.exit(1) when both JWT_SECRET and DB_NAME are missing', () => {
    delete process.env.JWT_SECRET;
    delete process.env.DB_NAME;
    runValidate();
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('logs an error message on validation failure', () => {
    delete process.env.JWT_SECRET;
    process.env.DB_NAME = 'test.db';
    runValidate();
    expect(consoleErrorMock).toHaveBeenCalled();
    const output = consoleErrorMock.mock.calls[0][0];
    expect(output).toMatch(/ENV VALIDATION FAILED/i);
  });

  it('accepts JWT_SECRET exactly 32 chars long', () => {
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.DB_NAME = 'test.db';
    runValidate();
    expect(exitMock).not.toHaveBeenCalled();
  });
});
