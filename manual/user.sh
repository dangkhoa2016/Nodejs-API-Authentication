# 1 - login using admin credentials
curl -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' \
  http://localhost:4000/users/login | jq
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsImV4cCI6MTczNzg5MjM4NCwianRpIjoiMS4xNzM3ODg4Nzg0In0.pe3frALkUN7CYFSd_5QCu03FyaPNVvkLWeqrql_jGOo",
  "user": {
    "id": 1,
    "email": "admin@localhost.test",
    "username": "admin",
    "first_name": "",
    "last_name": "",
    "avatar": null,
    "role": "admin",
    "confirmed_at": null,
    "created_at": "2025-01-26T04:24:11.548Z",
    "updated_at": "2025-01-26T04:24:33.823Z"
  }
}

# 2 - login using user credentials
curl -X POST localhost:4000/users/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "password": "password"}' \
  | jq
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwidXNlcm5hbWUiOiJ1c2VyIiwiZXhwIjoxNzM3ODkyNDE0LCJqdGkiOiIyLjE3Mzc4ODg4MTQifQ.VJwbibnw85H9ttt8uBDVl-2DV0ZAmHNJYof90-yEmcI",
  "user": {
    "id": 2,
    "email": "test@user.local",
    "username": "user",
    "first_name": "",
    "last_name": "",
    "avatar": null,
    "role": "user",
    "confirmed_at": null,
    "created_at": "2025-01-26T04:26:08.658Z",
    "updated_at": "2025-01-26T04:26:46.712Z"
  }
}

# 3 - get all users using admin token
curl -X GET localhost:4000/users \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsImV4cCI6MTczNzg5MjM4NCwianRpIjoiMS4xNzM3ODg4Nzg0In0.pe3frALkUN7CYFSd_5QCu03FyaPNVvkLWeqrql_jGOo" \
  -H "Content-Type: application/json" \
  | jq
{
  "count": 2,
  "users": [
    {
      "id": 1,
      "email": "admin@localhost.test",
      "username": "admin",
      "first_name": "",
      "last_name": "",
      "avatar": null,
      "role": "admin",
      "confirmed_at": null,
      "created_at": "2025-01-26T10:52:43.136Z",
      "updated_at": "2025-01-26T10:53:04.742Z"
    },
    {
      "id": 2,
      "email": "test@user.local",
      "username": "user",
      "first_name": "",
      "last_name": "",
      "avatar": null,
      "role": "user",
      "confirmed_at": null,
      "created_at": "2025-01-26T10:53:25.707Z",
      "updated_at": "2025-01-26T10:53:34.354Z"
    }
  ]
}

# 4 - get users using user token
curl -X GET localhost:4000/users \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwidXNlcm5hbWUiOiJ1c2VyIiwiZXhwIjoxNzM3ODkyNDE0LCJqdGkiOiIyLjE3Mzc4ODg4MTQifQ.VJwbibnw85H9ttt8uBDVl-2DV0ZAmHNJYof90-yEmcI" \
  -H "Content-Type: application/json" \
  | jq
{
  "error": "You must be an administrator to perform this action"
}

# 5 - get users without token
curl -X GET localhost:4000/users \
 -H "Content-Type: application/json" \
  | jq
{
  "error": "Unauthorized",
  "message": "no authorization included in request"
}

# 6 - create a new user as role: user
curl -X POST -d '{
  "email": "user2@test.local",
  "password": "password",
  "first_name": "User",
  "last_name": "Two",
  "role": "admin",
  "username": "user2"
}' "http://localhost:4000/users/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwidXNlcm5hbWUiOiJ1c2VyIiwiZXhwIjoxNzM3ODkyNDE0LCJqdGkiOiIyLjE3Mzc4ODg4MTQifQ.VJwbibnw85H9ttt8uBDVl-2DV0ZAmHNJYof90-yEmcI" \
  | jq
{
  "error": "You must be an administrator to perform this action"
}

# 7 - create a new user as role: admin
curl -X POST -d '{
    "email": "user2@test.local",
    "password": "password",
    "first_name": "User",
    "last_name": "Two",
    "role": "admin",
    "username": "user2"
  }' "http://localhost:4000/users/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsImV4cCI6MTczNzg5MjM4NCwianRpIjoiMS4xNzM3ODg4Nzg0In0.pe3frALkUN7CYFSd_5QCu03FyaPNVvkLWeqrql_jGOo" \
  | jq
{
  "message": "User created successfully",
  "user": {
    "id": 3,
    "email": "user2@test.local",
    "username": "user2",
    "first_name": "",
    "last_name": "",
    "role": "user",
    "created_at": "2025-01-26T10:54:44.047Z",
    "updated_at": "2025-01-26T10:54:44.047Z"
  }
}

# 8 - update user as role: user
curl -X POST -d '{
    "email": "user3@test.local",
    "password": "password",
    "first_name": "User3",
    "last_name": "Three",
    "role": "admin",
    "username": "user3"
  }' "http://localhost:4000/users/3" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwidXNlcm5hbWUiOiJ1c2VyIiwiZXhwIjoxNzM3ODkyNDE0LCJqdGkiOiIyLjE3Mzc4ODg4MTQifQ.VJwbibnw85H9ttt8uBDVl-2DV0ZAmHNJYof90-yEmcI" \
  | jq
{
  "error": "You must be an administrator to perform this action"
}

# 9 - update user as role: admin
curl -X PUT -d '{
    "email": "user3@test.local",
    "password": "password",
    "first_name": "User3",
    "last_name": "Three",
    "role": "admin",
    "username": "user3"
  }' "http://localhost:4000/users/3" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsImV4cCI6MTczNzg5MjM4NCwianRpIjoiMS4xNzM3ODg4Nzg0In0.pe3frALkUN7CYFSd_5QCu03FyaPNVvkLWeqrql_jGOo" \
  | jq
{
  "message": "User updated successfully",
  "user": {
    "id": 3,
    "email": "user3@test.local",
    "username": "user3",
    "first_name": "User3",
    "last_name": "Three",
    "avatar": null,
    "role": "admin",
    "confirmed_at": null,
    "created_at": "2025-01-26T10:54:44.047Z",
    "updated_at": "2025-01-26T10:58:56.684Z"
  }
}

# 10 - delete user as role: user
curl -X DELETE "http://localhost:4000/users/3" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwidXNlcm5hbWUiOiJ1c2VyIiwiZXhwIjoxNzM3ODkyNDE0LCJqdGkiOiIyLjE3Mzc4ODg4MTQifQ.VJwbibnw85H9ttt8uBDVl-2DV0ZAmHNJYof90-yEmcI" \
  | jq
{
  "error": "You must be an administrator to perform this action"
}

# 11 - delete user as role: admin
curl -X DELETE "http://localhost:4000/users/3" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsImV4cCI6MTczNzg5MjM4NCwianRpIjoiMS4xNzM3ODg4Nzg0In0.pe3frALkUN7CYFSd_5QCu03FyaPNVvkLWeqrql_jGOo" \
  | jq
{
  "message": "User with id: 3 has been deleted successfully"
}

# 12 - delete user as role: admin again
curl -X DELETE "http://localhost:4000/users/3" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsImV4cCI6MTczNzg5MjM4NCwianRpIjoiMS4xNzM3ODg4Nzg0In0.pe3frALkUN7CYFSd_5QCu03FyaPNVvkLWeqrql_jGOo" \
  | jq
{
  "message": "User deleted successfully. Note: User not found"
}
