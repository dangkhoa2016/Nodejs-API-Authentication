
# Register a new user

# 1. Register without email address
curl -X POST localhost:4000/users/register \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "password": "password"}'
{"error":"Email is required"}

# 2. Register without username
curl -X POST localhost:4000/users/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@user.local", "password": "password"}'
{"error":"Username and password are required"}

# 3. Register without password
curl -X POST localhost:4000/users/register \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "email": "test@user.local"}'
{"error":"Username and password are required"}

# 4. Register with invalid email address
curl -X POST localhost:4000/users/register \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "email": "test", "password": "password"}'
{"error":"Email address must be valid"}

# 5. Register with valid data
curl -X POST localhost:4000/users \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "email": "test@user.local", "password": "password"}' \
  | jq
curl -X POST localhost:4000/users/register \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "email": "test@user.local", "password": "password"}' \
  | jq
{
  "message": "User created successfully",
  "user": {
    "first_name": "",
    "last_name": "",
    "role": "user",
    "sign_in_count": 0,
    "failed_attempts": 0,
    "id": 1,
    "email": "test@user.local",
    "username": "user",
    "updated_at": "2025-01-24T11:24:12.454Z",
    "created_at": "2025-01-24T11:24:12.454Z"
  }
}

# 6. Register with existing email address
curl -X POST localhost:4000/users/register \
  -H "Content-Type: application/json" \
  -d '{"username": "user1", "email": "test@user.local", "password": "password"}'
# {"error":"Username or email already exists"}
{"error":"email address must be unique"}

# 7. Register with existing username
curl -X POST localhost:4000/users/register \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "email": "test1@user.local", "password": "password"}'
# {"error":"Username or email already exists"}
{"error":"username must be unique"}

# ----------------------------------------------------------------

# Login

# 1. Login without email address
curl -X POST localhost:4000/users/login \
  -H "Content-Type: application/json" \
  -d '{"password": "password"}'
{"error":"Username and password are required"}

# 2. Login without password
curl -X POST localhost:4000/users/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user"}'
{"error":"Username and password are required"}

# 3. Login with invalid username
curl -X POST localhost:4000/users/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user1", "password": "password"}'
{"error":"Invalid credentials"}

# 4. Login with invalid password
curl -X POST localhost:4000/users/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "password": "password1"}'
{"error":"Invalid credentials"}

# 5. Login with valid data
curl -X POST localhost:4000/users/sign_in \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "password": "password"}' \
  | jq
curl -X POST localhost:4000/users/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "password": "password"}' \
  | jq
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJ1c2VyIiwiZXhwIjoxNzM3NzIxNTEwLCJqdGkiOiIxLjE3Mzc3MTc5MTAifQ.appzouoVp3F42boGB2Kvn8zy4Dp4F1Z73fzDxEZkaw0",
  "user": {
    "id": 1,
    "email": "test@user.local",
    "username": "user",
    "first_name": "",
    "last_name": "",
    "avatar": null,
    "role": "user",
    "reset_password_token": null,
    "reset_password_sent_at": null,
    "remember_created_at": null,
    "sign_in_count": 1,
    "current_sign_in_at": "2025-01-24T11:25:10.188Z",
    "last_sign_in_at": null,
    "current_sign_in_ip": "::1",
    "last_sign_in_ip": null,
    "confirmation_token": null,
    "confirmed_at": null,
    "confirmation_sent_at": null,
    "unconfirmed_email": null,
    "failed_attempts": 0,
    "unlock_token": null,
    "locked_at": null,
    "created_at": "2025-01-24T11:24:12.454Z",
    "updated_at": "2025-01-24T11:25:10.188Z"
  }
}

# ----------------------------------------------------------------

# 1. Get profile with valid token but the user does not exist
curl localhost:4000/user/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJ1c2VyIiwiZXhwIjoxNzQxMzAzNjk3LCJqdGkiOiIxLjE3Mzc3MDM2OTcifQ.QEhwn_pTU16_fA-4pzWVJQ0hsaoJL8Edhb8SWBISLkY" \
  | jq
{
  "error": "User not found"
}

# 2. Get profile with valid token
curl localhost:4000/users/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJ1c2VyIiwiZXhwIjoxNzM3NzIxNTEwLCJqdGkiOiIxLjE3Mzc3MTc5MTAifQ.appzouoVp3F42boGB2Kvn8zy4Dp4F1Z73fzDxEZkaw0" \
  | jq
{
  "id": 1,
  "email": "test@user.local",
  "username": "user",
  "first_name": "",
  "last_name": "",
  "avatar": null,
  "role": "user",
  "reset_password_token": null,
  "reset_password_sent_at": null,
  "remember_created_at": null,
  "sign_in_count": 1,
  "current_sign_in_at": "2025-01-24T01:41:12.714Z",
  "last_sign_in_at": null,
  "current_sign_in_ip": "::1",
  "last_sign_in_ip": null,
  "confirmation_token": null,
  "confirmed_at": null,
  "confirmation_sent_at": null,
  "unconfirmed_email": null,
  "failed_attempts": 0,
  "unlock_token": null,
  "locked_at": null,
  "created_at": "2025-01-24T01:40:35.584Z",
  "updated_at": "2025-01-24T01:41:12.714Z"
}

# 3. Get profile without token
curl localhost:4000/users/profile \
  | jq
{
  "error": "Unauthorized",
  "message": "no authorization included in request"
}

# 4. Get profile with invalid token
curl localhost:4000/users/profile \
  -H "Authorization: Bearer test"
{"error":"Unauthorized","message":"invalid JWT token: test"}

# 5. Get profile with expired token
curl localhost:4000/users/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJ1c2VyIiwiZXhwIjoxNzM3NzExNTYzLCJqdGkiOiIxLjE3Mzc3MTE1NjEifQ.bNHy9S3MmyvvvN6nWy2ln2fbJAdZvrr7LeGaV7N8iBQ"

{"error":"Unauthorized","message":"token (eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJ1c2VyIiwiZXhwIjoxNzM3NzExNTYzLCJqdGkiOiIxLjE3Mzc3MTE1NjEifQ.bNHy9S3MmyvvvN6nWy2ln2fbJAdZvrr7LeGaV7N8iBQ) expired"}


# ----------------------------------------------------------------

# Logout

# 1. Logout with valid token
curl -X GET localhost:4000/users/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJ1c2VyIiwiZXhwIjoxNzM3NzIxNTEwLCJqdGkiOiIxLjE3Mzc3MTc5MTAifQ.appzouoVp3F42boGB2Kvn8zy4Dp4F1Z73fzDxEZkaw0" \
  | jq
{
  "message": "Logout successful"
}

# 2. Logout without token
curl -X GET localhost:4000/users/logout \
  | jq
{
  "error": "Unauthorized",
  "message": "no authorization included in request"
}

# 3. Logout with invalid token
curl -X GET localhost:4000/users/logout \
  -H "Authorization: Bearer test" \
  | jq
{
  "error": "Unauthorized",
  "message": "invalid JWT token: test"
}

# 4. Logout with expired token
curl -X GET localhost:4000/users/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJ1c2VyIiwiZXhwIjoxNzM3NzExNTYzLCJqdGkiOiIxLjE3Mzc3MTE1NjEifQ.bNHy9S3MmyvvvN6nWy2ln2fbJAdZvrr7LeGaV7N8iBQ" \
  | jq
{
  "error": "Unauthorized",
  "message": "token (eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJ1c2VyIiwiZXhwIjoxNzM3NzExNTYzLCJqdGkiOiIxLjE3Mzc3MTE1NjEifQ.bNHy9S3MmyvvvN6nWy2ln2fbJAdZvrr7LeGaV7N8iBQ) expired"
}
