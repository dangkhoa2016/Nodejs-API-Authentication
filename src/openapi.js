'use strict';

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Nodejs API Authentication',
    version: '1.0.0',
    description: 'REST API for user authentication and management using Hono, JWT, Sequelize and bcrypt.',
    license: { name: 'MIT' },
  },
  servers: [
    { url: '/v1', description: 'Version 1 (recommended)' },
    { url: '/', description: 'Legacy (backward-compat)' },
  ],
  tags: [
    { name: 'system', description: 'Health & metadata' },
    { name: 'auth', description: 'Register, login, logout, token refresh, password/email flows' },
    { name: 'profile', description: 'Authenticated user profile' },
    { name: 'users', description: 'Admin user management' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id:           { type: 'integer', example: 1 },
          email:        { type: 'string', format: 'email', example: 'user@example.com' },
          username:     { type: 'string', example: 'johndoe' },
          first_name:   { type: 'string', example: 'John' },
          last_name:    { type: 'string', example: 'Doe' },
          avatar:       { type: 'string', nullable: true, example: null },
          role:         { type: 'string', enum: ['user', 'admin'], example: 'user' },
          confirmed_at: { type: 'string', format: 'date-time', nullable: true },
          created_at:   { type: 'string', format: 'date-time' },
          updated_at:   { type: 'string', format: 'date-time' },
        },
      },
      TokenPair: {
        type: 'object',
        properties: {
          token:         { type: 'string', description: 'JWT access token (1 hour)' },
          refresh_token: { type: 'string', description: 'Refresh token (7 days)' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Invalid credentials' },
        },
      },
      Message: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Operation successful' },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Missing or invalid access token',
        content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } },
      },
      Forbidden: {
        description: 'Insufficient permissions',
        content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } },
      },
      NotFound: {
        description: 'Resource not found',
        content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['system'],
        summary: 'Health check',
        description: 'Returns service status, database connectivity, uptime and version.',
        responses: {
          200: {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status:  { type: 'string', enum: ['ok', 'degraded'], example: 'ok' },
                    db:      { type: 'string', enum: ['ok', 'error'], example: 'ok' },
                    uptime:  { type: 'integer', description: 'Server uptime in seconds', example: 1234 },
                    version: { type: 'string', example: '1.0.0' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/users/register': {
      post: {
        tags: ['auth'],
        summary: 'Register a new user',
        description: 'Aliases: `POST /users`, `POST /users/sign_up`',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'username', 'password'],
                properties: {
                  email:    { type: 'string', format: 'email' },
                  username: { type: 'string' },
                  password: { type: 'string', format: 'password' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'User created',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { '$ref': '#/components/schemas/Message' },
                    { type: 'object', properties: { user: { '$ref': '#/components/schemas/User' } } },
                  ],
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
        },
      },
    },
    '/users/login': {
      post: {
        tags: ['auth'],
        summary: 'Login and obtain JWT tokens',
        description: 'Alias: `POST /users/sign_in`. Rate-limited to 5 requests/minute/IP.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string', format: 'password' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Login successful — returns access token + refresh token',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { '$ref': '#/components/schemas/Message' },
                    { '$ref': '#/components/schemas/TokenPair' },
                    { type: 'object', properties: { user: { '$ref': '#/components/schemas/User' } } },
                  ],
                },
              },
            },
          },
          400: { description: 'Invalid credentials', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          423: { description: 'Account locked', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
        },
      },
    },
    '/users/logout': {
      delete: {
        tags: ['auth'],
        summary: 'Logout (revoke access + refresh tokens)',
        description: 'Adds the JWT `jti` to the denylist and revokes the refresh token. Alias: `DELETE /users/sign_out`.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { refresh_token: { type: 'string', description: 'Optional: refresh token to revoke' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Logout successful', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Message' } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
        },
      },
    },
    '/users/profile': {
      get: {
        tags: ['profile'],
        summary: 'Get authenticated user profile',
        description: 'Aliases: `GET /user/me`, `GET /user/whoami`',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'User profile', content: { 'application/json': { schema: { '$ref': '#/components/schemas/User' } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
        },
      },
      patch: {
        tags: ['profile'],
        summary: 'Update own profile',
        description: 'Alias: `PUT /users`',
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  username:   { type: 'string' },
                  email:      { type: 'string', format: 'email' },
                  password:   { type: 'string', format: 'password' },
                  first_name: { type: 'string' },
                  last_name:  { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Profile updated', content: { 'application/json': { schema: { allOf: [{ '$ref': '#/components/schemas/Message' }, { type: 'object', properties: { user: { '$ref': '#/components/schemas/User' } } }] } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
        },
      },
      delete: {
        tags: ['profile'],
        summary: 'Delete own account',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Account deleted', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Message' } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['auth'],
        summary: 'Refresh access token (v1 only)',
        description: '`POST /v1/auth/refresh` — Rotates the refresh token and issues a new access token.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refresh_token'],
                properties: { refresh_token: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'New token pair', content: { 'application/json': { schema: { '$ref': '#/components/schemas/TokenPair' } } } },
          401: { description: 'Invalid/expired refresh token', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
        },
      },
    },
    '/auth/forgot-password': {
      post: {
        tags: ['auth'],
        summary: 'Request a password reset link (v1 only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Response is always the same to prevent user enumeration', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Message' } } } },
        },
      },
    },
    '/auth/reset-password': {
      post: {
        tags: ['auth'],
        summary: 'Reset password using a token (v1 only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'password'],
                properties: {
                  token:    { type: 'string' },
                  password: { type: 'string', format: 'password' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Password reset', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Message' } } } },
          400: { description: 'Invalid or expired token', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
        },
      },
    },
    '/auth/confirm-email': {
      post: {
        tags: ['auth'],
        summary: 'Confirm email address (v1 only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token'],
                properties: { token: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Email confirmed', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Message' } } } },
          400: { description: 'Invalid or expired token', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
        },
      },
    },
    '/auth/resend-confirmation': {
      post: {
        tags: ['auth'],
        summary: 'Resend email confirmation token (v1 only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Confirmation email sent (or no-op if already confirmed)', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Message' } } } },
        },
      },
    },
    '/users': {
      get: {
        tags: ['users'],
        summary: 'List all users (admin only)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, maximum: 100 } },
          { name: 'q', in: 'query', description: 'Search by email or username', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Paginated user list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    users: { type: 'array', items: { '$ref': '#/components/schemas/User' } },
                    total: { type: 'integer' },
                    page:  { type: 'integer' },
                    limit: { type: 'integer' },
                  },
                },
              },
            },
          },
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
        },
      },
    },
    '/users/create': {
      post: {
        tags: ['users'],
        summary: 'Create a user (admin only)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'username', 'password'],
                properties: {
                  email:    { type: 'string', format: 'email' },
                  username: { type: 'string' },
                  password: { type: 'string', format: 'password' },
                  role:     { type: 'string', enum: ['user', 'admin'], default: 'user' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'User created', content: { 'application/json': { schema: { allOf: [{ '$ref': '#/components/schemas/Message' }, { type: 'object', properties: { user: { '$ref': '#/components/schemas/User' } } }] } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
        },
      },
    },
    '/users/{id}': {
      put: {
        tags: ['users'],
        summary: 'Update a user (admin only)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email:      { type: 'string', format: 'email' },
                  username:   { type: 'string' },
                  password:   { type: 'string', format: 'password' },
                  first_name: { type: 'string' },
                  last_name:  { type: 'string' },
                  role:       { type: 'string', enum: ['user', 'admin'] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'User updated', content: { 'application/json': { schema: { allOf: [{ '$ref': '#/components/schemas/Message' }, { type: 'object', properties: { user: { '$ref': '#/components/schemas/User' } } }] } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
          404: { '$ref': '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['users'],
        summary: 'Delete a user (admin only)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'User deleted', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Message' } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
          404: { '$ref': '#/components/responses/NotFound' },
        },
      },
    },
  },
};

module.exports = spec;
