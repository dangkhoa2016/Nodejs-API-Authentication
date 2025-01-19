curl -X GET localhost:4000/
{"message":"Welcome to the Node.js API Authentication"}

curl -X GET localhost:4000/favicon.ico -i
HTTP/1.1 200 OK
content-length: 126931
content-type: image/x-icon
Date: Fri, 24 Jan 2025 12:08:04 GMT
Connection: keep-alive
Keep-Alive: timeout=5

curl -X GET localhost:4000/favicon.png -i
HTTP/1.1 200 OK
content-length: 66188
content-type: image/png
Date: Fri, 24 Jan 2025 12:07:53 GMT
Connection: keep-alive
Keep-Alive: timeout=5
