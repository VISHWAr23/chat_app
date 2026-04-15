# 💬 NestJS Real-Time Chat Backend

A minimal, production-ready real-time chat backend built with **NestJS**, **Socket.IO**, **Redis**, and **MongoDB**.

---

## 📁 Project Structure

```
src/
├── main.ts                     # App entry point
├── app.module.ts               # Root module
├── chat/
│   ├── chat.module.ts          # Chat feature module
│   ├── chat.gateway.ts         # WebSocket gateway (Socket.IO events)
│   └── chat.service.ts         # Redis + MongoDB logic
├── redis/
│   └── redis.provider.ts       # ioredis client provider
└── mongo/
    └── message.schema.ts       # Mongoose schema for messages
test-client.html                # Browser-based test UI
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- Redis running locally (`redis-server`)
- MongoDB running locally (`mongod`)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Edit `.env` (already provided):

```env
PORT=4000
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_USERNAME=
REDIS_PASSWORD=
REDIS_URL=
REDIS_TLS=false
MONGODB_URI=mongodb://localhost:27017/nest-chat
```

### Using Online Redis (Redis Cloud / Upstash / Railway / Render)

Prefer `REDIS_URL` for hosted Redis:

```env
REDIS_URL=rediss://default:YOUR_PASSWORD@YOUR_HOST:YOUR_PORT
REDIS_TLS=true
```

Notes:

- If `REDIS_URL` is set, it is used first.
- `rediss://` enables TLS automatically.
- Keep local values (`REDIS_HOST`, `REDIS_PORT`) for local development fallback.

### 3. Start Redis & MongoDB

```bash
# Redis
redis-server

# MongoDB
mongod --dbpath /data/db
```

### 4. Run the Server

```bash
# Development (with hot reload)
npm run start:dev

# Production
npm run build && npm run start:prod
```

Server starts at: `http://localhost:4000`

---

## 🔌 WebSocket Events

### Client → Server

| Event          | Payload                                          | Description                         |
|----------------|--------------------------------------------------|-------------------------------------|
| `join`         | `{ userId: string }`                             | Register user, store in Redis       |
| `sendMessage`  | `{ senderId, receiverId, message }`              | Send a private message              |
| `getHistory`   | `{ userId1, userId2 }`                           | Fetch last 50 messages from MongoDB |
| `typing`       | `{ senderId, receiverId, isTyping }`             | Send typing state to receiver        |

### Server → Client

| Event            | Payload                                             | Description                        |
|------------------|-----------------------------------------------------|------------------------------------|
| `joined`         | `{ success, userId, socketId, message }`           | Confirms successful join           |
| `receiveMessage` | `{ senderId, receiverId, message, timestamp, messageId }` | Incoming message for receiver |
| `messageSent`    | `{ success, delivered, ...messagePayload }`        | Delivery acknowledgment to sender  |
| `chatHistory`    | `{ userId1, userId2, messages[] }`                 | Chat history between two users     |
| `presence`       | `{ userId, isOnline }`                             | Online/offline user status         |
| `typing`         | `{ senderId, receiverId, isTyping }`               | Typing status update               |
| `error`          | `{ message: string }`                              | Validation or runtime error        |

## 🔐 Authentication APIs

### `POST /auth/signup`

Request body:

```json
{
    "email": "name@gmail.com",
    "password": "secret123",
    "name": "Display Name"
}
```

### `POST /auth/login`

Request body:

```json
{
    "email": "name@gmail.com",
    "password": "secret123"
}
```

---

## 🧪 Testing with the Browser Client

1. Open `test-client.html` in your browser (just double-click it)
2. Connect to `http://localhost:3000`
3. Open a second tab, connect again
4. Each tab joins with a different userId (e.g. `alice` and `bob`)
5. Send messages between them

---

## 🧱 Architecture

```
Client A ──ws──► NestJS Gateway
                     │
               ChatService
               /          \
          Redis           MongoDB
   (userId→socketId)   (message history)
               \
         NestJS Gateway ──ws──► Client B
```

- **Redis** stores active user sessions (`user:<userId>` → `socketId`) with 24h TTL
- **MongoDB** persists all messages for history retrieval
- If the receiver is offline, the message is still saved to MongoDB for later retrieval

---

## 📦 Key Dependencies

| Package                  | Purpose                          |
|--------------------------|----------------------------------|
| `@nestjs/websockets`     | NestJS WebSocket support         |
| `@nestjs/platform-socket.io` | Socket.IO adapter           |
| `ioredis`                | Redis client                     |
| `@nestjs/mongoose`       | MongoDB/Mongoose integration     |
| `mongoose`               | MongoDB ODM                      |
