'use strict';

// Must be set BEFORE any src/ module is required
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long';
process.env.DB_NAME = ':memory:';
// Use low bcrypt rounds for speed in tests
process.env.HASH_SALT = '4';
// Disable winston file transport noise
process.env.LOG_FOLDER = '/tmp';
// Disable rate limiter in tests (high limit)
process.env.LOGIN_RATE_LIMIT = '1000';
