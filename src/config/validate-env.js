'use strict';

/**
 * Validate required environment variables at startup.
 * Throws an error and halts boot if any required variable is missing or invalid.
 */
const requiredVars = [
  { name: 'JWT_SECRET', minLength: 32 },
  { name: 'DB_NAME' },
];

const validate = () => {
  const errors = [];

  for (const { name, minLength } of requiredVars) {
    const value = process.env[name];

    if (!value) {
      errors.push(`Missing required environment variable: ${name}`);
      continue;
    }

    if (minLength && value.length < minLength) {
      errors.push(
        `Environment variable ${name} must be at least ${minLength} characters long (current: ${value.length})`,
      );
    }
  }

  if (errors.length > 0) {
    console.error('\n[ENV VALIDATION FAILED]\n' + errors.map(e => '  - ' + e).join('\n') + '\n');
    process.exit(1);
  }
};

module.exports = { validate };
