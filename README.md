# AI Meeting Intelligence Backend

A production-grade Node.js/TypeScript backend for video meeting upload, transcription, summary, and action item extraction using OpenAI and PostgreSQL.

## Features

- Video upload and storage
- Audio extraction and transcription (OpenAI Whisper)
- Meeting summary and action item extraction (OpenAI GPT)
- REST API for meetings and action items
- JWT authentication and role-based authorization
- Scalable async processing with RabbitMQ

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Configure environment:**
   - Copy `.env` and set DB, JWT, and OpenAI keys.
3. **Run database migrations:**
   ```bash
   npx ts-node src/migrations/createTables.ts
   ```
4. **Start the backend:**
   ```bash
   npm run dev
   ```
5. **Start the worker:**
   ```bash
   npx ts-node src/worker/meetingConsumer.ts
   ```

## API Usage Examples

### Auth

- **Signup:**

  ```http
  POST /api/auth/signup
  { "email": "user@example.com", "password": "yourpassword" }
  ```

  **Success Response:**

  ```json
  {
    "success": true,
    "statusCode": 201,
    "message": "Signup successful",
    "data": {
      "user": {
        "id": "string",
        "email": "user@example.com",
        "role": "user"
      }
    },
    "timestamp": "2026-03-21T12:34:56.789Z"
  }
  ```

  **Error Response:**

  ```json
  { "error": "Signup failed" }
  ```

- **Login:**
  ```http
  POST /api/auth/login
  { "email": "user@example.com", "password": "yourpassword" }
  ```
  **Success Response:**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Login successful",
    "data": {
      "token": "jwt-token-string",
      "user": {
        "id": "string",
        "email": "user@example.com",
        "role": "user"
      }
    },
    "timestamp": "2026-03-21T12:34:56.789Z"
  }
  ```
  **Error Response:**
  ```json
  { "error": "Login failed" }
  ```

### Meetings

- **Upload Meeting Video:**

  ```http
  POST /api/meetings/upload
  (multipart/form-data, field: file)
  Headers: Authorization: Bearer <token>
  ```

  **Success Response:**

  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Video uploaded successfully",
    "data": {
      "meetingId": "string"
    },
    "timestamp": "2026-03-21T12:34:56.789Z"
  }
  ```

  **Error Response:**

  ```json
  { "error": "Only video files are allowed" }
  // or
  { "error": "File too large" }
  // or
  { "error": "Upload failed" }
  ```

- **Get My Meetings:**
  ```http
  GET /api/meetings/my-meetings
  Headers: Authorization: Bearer <token>
  ```
  **Success Response:**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Meetings fetched successfully",
    "data": [
      {
        "id": "string",
        "user_id": "string",
        "video_path": "string",
        "audio_path": "string",
        "status": "pending|completed|failed",
        "transcript": "string",
        "summary": "string"
      }
    ],
    "timestamp": "2026-03-21T12:34:56.789Z"
  }
  ```
  **Error Response:**
  ```json
  { "error": "Failed to fetch meetings" }
  ```

### Action Items

- **Get Action Items for a Meeting:**

  ```http
  GET /api/action-items/meetings/:id/action-items
  Headers: Authorization: Bearer <token>
  ```

  **Success Response:**

  ```json
  {
    "actionItems": [
      {
        "id": "string",
        "meeting_id": "string",
        "task": "string",
        "assignee": "string",
        "status": "pending|done"
      }
    ]
  }
  ```

  **Error Response:**

  ```json
  { "error": "Failed to fetch action items" }
  ```

- **Get Action Items by Assignee:**

  ```http
  GET /api/action-items/action-items?assignee=John
  Headers: Authorization: Bearer <token>
  ```

  **Success Response:**

  ```json
  {
    "actionItems": [
      {
        "id": "string",
        "meeting_id": "string",
        "task": "string",
        "assignee": "John",
        "status": "pending|done"
      }
    ]
  }
  ```

  **Error Response:**

  ```json
  { "error": "Failed to fetch action items" }
  ```

- **Update Action Item:**
  ```http
  PATCH /api/action-items/action-items/:id
  Body: { "status": "done" }
  Headers: Authorization: Bearer <token>
  ```
  **Success Response:**
  ```json
  { "success": true }
  ```
  **Error Response:**
  ```json
  { "error": "Failed to update action item" }
  ```

## Contributing

- Fork, branch, and submit PRs.
- Follow commit message and linting rules (see Husky/commitlint setup).

## License

MIT
