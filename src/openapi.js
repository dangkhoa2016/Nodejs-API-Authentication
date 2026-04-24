'use strict';

const rootServer = [{ url: '/', description: 'Root paths' }];
const legacyAndV1Servers = [
  { url: '/', description: 'Legacy root' },
  { url: '/v1', description: 'Versioned mirror' },
];
const v1OnlyServers = [{ url: '/v1', description: 'Version 1 only' }];

const profileUpdateSchema = {
  type: 'object',
  properties: {
    username: { type: 'string' },
    email: { type: 'string', format: 'email' },
    password: { type: 'string', format: 'password' },
    first_name: { type: 'string' },
    last_name: { type: 'string' },
  },
};

const adminUserWriteSchema = {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    username: { type: 'string' },
    password: { type: 'string', format: 'password' },
    first_name: { type: 'string' },
    last_name: { type: 'string' },
    role: { type: 'string', enum: ['user', 'admin'] },
  },
};

const logoutRequestBody = {
  required: false,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          refresh_token: { type: 'string', description: 'Optional refresh token to revoke during logout' },
        },
      },
    },
  },
};

const selfProfileResponses = {
  200: {
    description: 'User profile',
    content: {
      'application/json': {
        schema: { '$ref': '#/components/schemas/User' },
      },
    },
  },
  401: { '$ref': '#/components/responses/Unauthorized' },
  404: { '$ref': '#/components/responses/NotFound' },
};

const selfProfileUpdateResponses = {
  200: {
    description: 'Profile updated',
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
  401: { '$ref': '#/components/responses/Unauthorized' },
  404: { '$ref': '#/components/responses/NotFound' },
};

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Nodejs API Authentication',
    version: '1.0.0',
    description: 'REST API for user authentication and management using Hono, JWT, Sequelize and bcrypt.',
    license: { name: 'MIT' },
  },
  servers: rootServer,
  tags: [
    { name: 'system', description: 'Health, metadata, and documentation endpoints' },
    { name: 'auth', description: 'Register, login, logout, token refresh, password reset, and email confirmation' },
    { name: 'profile', description: 'Authenticated user profile endpoints' },
    { name: 'users', description: 'Admin user management endpoints' },
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
          id: { type: 'integer', example: 1 },
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          username: { type: 'string', example: 'johndoe' },
          first_name: { type: 'string', example: 'John' },
          last_name: { type: 'string', example: 'Doe' },
          avatar: { type: 'string', nullable: true, example: null },
          role: { type: 'string', enum: ['user', 'admin'], example: 'user' },
          confirmed_at: { type: 'string', format: 'date-time', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      TokenPair: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'JWT access token (1 hour)' },
          refresh_token: { type: 'string', description: 'Refresh token (7 days)' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Invalid credentials' },
          message: { type: 'string', nullable: true, example: 'no authorization included in request' },
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
        description: 'Missing, invalid, or expired access token',
        content: {
          'application/json': {
            schema: { '$ref': '#/components/schemas/Error' },
          },
        },
      },
      Forbidden: {
        description: 'Insufficient permissions',
        content: {
          'application/json': {
            schema: { '$ref': '#/components/schemas/Error' },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { '$ref': '#/components/schemas/Error' },
          },
        },
      },
    },
  },
  paths: {
    '/': {
      get: {
        tags: ['system'],
        summary: 'Welcome endpoint',
        description: 'Returns the root welcome message. This endpoint exists only at the root and is not mirrored under /v1.',
        responses: {
          200: {
            description: 'Welcome message',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Welcome to the Node.js API Authentication' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/health': {
      get: {
        tags: ['system'],
        summary: 'Health check',
        description: 'Returns service status, database connectivity, uptime, and application version. This endpoint exists only at the root.',
        responses: {
          200: {
            description: 'Health status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ok', 'degraded'], example: 'ok' },
                    db: { type: 'string', enum: ['ok', 'error'], example: 'ok' },
                    uptime: { type: 'integer', description: 'Server uptime in seconds', example: 1234 },
                    version: { type: 'string', example: '1.0.0' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/openapi.json': {
      get: {
        tags: ['system'],
        summary: 'OpenAPI specification',
        description: 'Serves the raw OpenAPI document consumed by Swagger UI. This endpoint exists only at the root.',
        responses: {
          200: {
            description: 'OpenAPI JSON document',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
        },
      },
    },
    '/docs': {
      get: {
        tags: ['system'],
        summary: 'Swagger UI',
        description: 'Serves the interactive Swagger UI at the root only.',
        responses: {
          200: {
            description: 'HTML documentation UI',
            content: {
              'text/html': {
                schema: { type: 'string' },
              },
            },
          },
        },
      },
    },
    '/users/register': {
      servers: legacyAndV1Servers,
      post: {
        tags: ['auth'],
        summary: 'Register a new user',
        description: 'Aliases: POST /users and POST /users/sign_up.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'username', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
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
          429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
        },
      },
    },
    '/users/login': {
      servers: legacyAndV1Servers,
      post: {
        tags: ['auth'],
        summary: 'Login and obtain access plus refresh tokens',
        description: 'Alias: POST /users/sign_in. Rate-limited per IP.',
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
            description: 'Login successful',
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
          400: { description: 'Invalid credentials or missing fields', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          423: { description: 'Account locked', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
        },
      },
    },
    '/users/logout': {
      servers: legacyAndV1Servers,
      delete: {
        tags: ['auth'],
        summary: 'Logout via DELETE',
        description: 'Adds the access-token JTI to the denylist and optionally revokes the supplied refresh token. Alias: DELETE /users/sign_out.',
        security: [{ BearerAuth: [] }],
        requestBody: logoutRequestBody,
        responses: {
          200: { description: 'Logout successful', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Message' } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['auth'],
        summary: 'Logout via POST',
        description: 'Same behavior as DELETE /users/logout. Alias: POST /users/sign_out.',
        security: [{ BearerAuth: [] }],
        requestBody: logoutRequestBody,
        responses: {
          200: { description: 'Logout successful', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Message' } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
        },
      },
    },
    '/users/profile': {
      servers: legacyAndV1Servers,
      get: {
        tags: ['profile'],
        summary: 'Get the authenticated user profile',
        description: 'Aliases: GET /user/me and GET /user/whoami.',
        security: [{ BearerAuth: [] }],
        responses: selfProfileResponses,
      },
      put: {
        tags: ['profile'],
        summary: 'Replace or update your own profile',
        description: 'Alias: PUT /users.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: profileUpdateSchema,
            },
          },
        },
        responses: selfProfileUpdateResponses,
      },
      patch: {
        tags: ['profile'],
        summary: 'Partially update your own profile',
        description: 'Alias: PATCH /users.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: profileUpdateSchema,
            },
          },
        },
        responses: selfProfileUpdateResponses,
      },
    },
    '/users': {
      servers: legacyAndV1Servers,
      get: {
        tags: ['users'],
        summary: 'List users (admin only)',
        description: 'Alias: GET /users/all.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1, minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, minimum: 1, maximum: 100 } },
          { name: 'q', in: 'query', description: 'Search by email or username', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'User list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    count: { type: 'integer', example: 1 },
                    users: { type: 'array', items: { '$ref': '#/components/schemas/User' } },
                  },
                },
              },
            },
          },
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
        },
      },
      put: {
        tags: ['profile'],
        summary: 'Replace or update your own profile',
        description: 'Alias: PUT /users/profile.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: profileUpdateSchema,
            },
          },
        },
        responses: selfProfileUpdateResponses,
      },
      patch: {
        tags: ['profile'],
        summary: 'Partially update your own profile',
        description: 'Alias: PATCH /users/profile.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: profileUpdateSchema,
            },
          },
        },
        responses: selfProfileUpdateResponses,
      },
      delete: {
        tags: ['profile'],
        summary: 'Delete your own account',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Account deleted',
            content: {
              'application/json': {
                schema: { '$ref': '#/components/schemas/Message' },
              },
            },
          },
          401: { '$ref': '#/components/responses/Unauthorized' },
          404: { '$ref': '#/components/responses/NotFound' },
        },
      },
    },
    '/auth/refresh': {
      servers: v1OnlyServers,
      post: {
        tags: ['auth'],
        summary: 'Rotate the refresh token and issue a new access token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refresh_token'],
                properties: {
                  refresh_token: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'New token pair', content: { 'application/json': { schema: { '$ref': '#/components/schemas/TokenPair' } } } },
          400: { description: 'Missing refresh token', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          401: { description: 'Invalid or expired refresh token', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          404: { '$ref': '#/components/responses/NotFound' },
          429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
        },
      },
    },
    '/auth/forgot-password': {
      servers: v1OnlyServers,
      post: {
        tags: ['auth'],
        summary: 'Request a password reset link',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', format: 'email' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Generic response to avoid user enumeration. In development and test environments, debug_token is also returned.',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { '$ref': '#/components/schemas/Message' },
                    { type: 'object', properties: { debug_token: { type: 'string', nullable: true } } },
                  ],
                },
              },
            },
          },
          400: { description: 'Email is required', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
        },
      },
    },
    '/auth/reset-password': {
      servers: v1OnlyServers,
      post: {
        tags: ['auth'],
        summary: 'Reset a password with a reset token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'password'],
                properties: {
                  token: { type: 'string' },
                  password: { type: 'string', format: 'password' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Password reset', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Message' } } } },
          400: { description: 'Missing, invalid, or expired token', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
        },
      },
    },
    '/auth/confirm-email': {
      servers: v1OnlyServers,
      post: {
        tags: ['auth'],
        summary: 'Confirm an email address',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token'],
                properties: {
                  token: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Email confirmed', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Message' } } } },
          400: { description: 'Missing, invalid, or expired confirmation token', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
        },
      },
    },
    '/auth/resend-confirmation': {
      servers: v1OnlyServers,
      post: {
        tags: ['auth'],
        summary: 'Resend an email confirmation token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', format: 'email' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Generic response to avoid user enumeration. In development and test environments, debug_token may also be returned.',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { '$ref': '#/components/schemas/Message' },
                    { type: 'object', properties: { debug_token: { type: 'string', nullable: true } } },
                  ],
                },
              },
            },
          },
          400: { description: 'Email is required', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
        },
      },
    },
    '/users/create': {
      servers: legacyAndV1Servers,
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
                  email: { type: 'string', format: 'email' },
                  username: { type: 'string' },
                  password: { type: 'string', format: 'password' },
                  first_name: { type: 'string' },
                  last_name: { type: 'string' },
                  role: { type: 'string', enum: ['user', 'admin'], default: 'user' },
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
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
        },
      },
    },
    '/users/{id}': {
      servers: legacyAndV1Servers,
      put: {
        tags: ['users'],
        summary: 'Update a user (admin only)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: adminUserWriteSchema,
            },
          },
        },
        responses: {
          200: {
            description: 'User updated',
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
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
          404: { '$ref': '#/components/responses/NotFound' },
        },
      },
      patch: {
        tags: ['users'],
        summary: 'Partially update a user (admin only)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: adminUserWriteSchema,
            },
          },
        },
        responses: {
          200: {
            description: 'User updated',
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
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
          404: { '$ref': '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['users'],
        summary: 'Delete a user (admin only)',
        description: 'Aliases: DELETE or POST /users/{id}/delete and /users/{id}/destroy. Deleting a missing user still returns 200 with a note in the message body.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: {
            description: 'Deletion handled',
            content: {
              'application/json': {
                schema: { '$ref': '#/components/schemas/Message' },
              },
            },
          },
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
        },
      },
    },
  },
};

module.exports = spec;