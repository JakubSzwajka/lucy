# Lucy - AI Chat Assistant PRD

## Overview

Lucy is a multi-model AI chat assistant with persistent conversation history. Users can chat with various AI models (OpenAI, Anthropic, Google) and switch models per-message within a conversation.

---

## Core Features

### 1. Multi-Model Chat
- Support for multiple AI providers and models
- User can select which model to use for each message
- Streaming responses (real-time text display as AI generates)
- Conversation context maintained across model switches

### 2. Conversation Management
- Create new conversations
- List all conversations (sorted by most recent)
- Switch between conversations
- Delete conversations
- Persistent storage (survives app restart)

### 3. Message History
- Full message history per conversation
- Messages stored with role (user/assistant), content, and timestamp
- History loaded when switching conversations
- Context sent to AI for continuity

---

## Supported Models

| Provider | Model ID | Display Name |
|----------|----------|--------------|
| OpenAI | `openai:gpt-4o` | GPT-4o |
| OpenAI | `openai:gpt-4o-mini` | GPT-4o Mini |
| OpenAI | `openai:gpt-4-turbo` | GPT-4 Turbo |
| Anthropic | `anthropic:claude-sonnet-4-20250514` | Claude Sonnet 4 |
| Anthropic | `anthropic:claude-haiku-4-20250514` | Claude Haiku 4 |
| Google | `google-gla:gemini-2.0-flash` | Gemini 2.0 Flash |
| Google | `google-gla:gemini-1.5-pro` | Gemini 1.5 Pro |

Models should be easily extensible via configuration.

---

## User Interface

### Layout (Desktop)

```
┌─────────────────────────────────────────────────────────────────┐
│ ┌─────────────┐ ┌─────────────────────────────────────────────┐ │
│ │   SIDEBAR   │ │                 MAIN AREA                   │ │
│ │             │ │                                             │ │
│ │ [+ New Chat]│ │  ┌─────────────────────────────────────┐   │ │
│ │             │ │  │            HEADER                   │   │ │
│ │ Conversation│ │  │            "Lucy"                   │   │ │
│ │ List        │ │  └─────────────────────────────────────┘   │ │
│ │             │ │                                             │ │
│ │ • Chat 1    │ │  ┌─────────────────────────────────────┐   │ │
│ │ • Chat 2 ←  │ │  │         MESSAGES AREA               │   │ │
│ │ • Chat 3    │ │  │                                     │   │ │
│ │             │ │  │  [User message]                     │   │ │
│ │             │ │  │  [Assistant message]                │   │ │
│ │             │ │  │  [User message]                     │   │ │
│ │             │ │  │  [Assistant message]                │   │ │
│ │             │ │  │                                     │   │ │
│ │             │ │  └─────────────────────────────────────┘   │ │
│ │             │ │                                             │ │
│ │             │ │  "Lucy is typing..."                       │ │
│ │             │ │                                             │ │
│ │             │ │  ┌─────────────────────────────────────┐   │ │
│ │             │ │  │  Model: [GPT-4o ▼]                  │   │ │
│ │             │ │  │  ┌─────────────────────────────┐    │   │ │
│ │             │ │  │  │ Message Lucy...          [→]│    │   │ │
│ │             │ │  │  └─────────────────────────────┘    │   │ │
│ │             │ │  └─────────────────────────────────────┘   │ │
│ └─────────────┘ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Components

#### Sidebar (260px width)
- **New Chat Button**: Creates new conversation, auto-focuses input
- **Conversation List**:
  - Shows conversation title (first user message or "New Chat")
  - Active conversation highlighted
  - Delete button appears on hover (× icon)
  - Click to switch conversations
  - Sorted by `updated_at` descending

#### Main Area
- **Header**: Shows "Lucy" or could show conversation title
- **Messages Area**:
  - Scrollable container
  - Messages max-width 800px, centered
  - User messages: accent color label ("You")
  - Assistant messages: muted color label ("Lucy")
  - Empty state: "Lucy" heading + "Start a conversation"
  - Auto-scroll to bottom on new messages
- **Typing Indicator**: "Lucy is typing..." shown during streaming
- **Input Area**:
  - Model selector dropdown (grouped by provider)
  - Textarea with placeholder "Message Lucy..."
  - Auto-resize textarea (1 row to max 200px)
  - Send button (arrow icon)
  - Enter to send, Shift+Enter for newline
  - Disabled during streaming

### Color Scheme (Dark Theme)

| Element | Color |
|---------|-------|
| Sidebar background | `#202123` |
| Main area background | `#343541` |
| Assistant message bg | `#444654` |
| Primary accent | `#10a37f` (green) |
| Text primary | `#ececf1` |
| Text muted | `#8e8ea0` |
| Border | `#565869` |
| Input background | `#40414f` |

---

## API Specification

### Models

#### Conversation
```json
{
  "id": "uuid-string",
  "title": "string",
  "created_at": "ISO8601 timestamp",
  "updated_at": "ISO8601 timestamp"
}
```

#### Message
```json
{
  "role": "user" | "assistant",
  "content": "string",
  "timestamp": "ISO8601 timestamp"
}
```

#### Model Info
```json
{
  "id": "provider:model-name",
  "name": "Human Readable Name",
  "provider": "openai" | "anthropic" | "google-gla"
}
```

### Endpoints

#### `GET /api/models`
List all available models.

**Response**: `ModelInfo[]`

---

#### `GET /api/models/default`
Get the default model.

**Response**: `ModelInfo`

---

#### `GET /api/conversations`
List all conversations, sorted by most recently updated.

**Response**: `Conversation[]`

---

#### `POST /api/conversations`
Create a new conversation.

**Request Body** (form-data):
- `conversation_id`: string (UUID)

**Response**:
```json
{
  "id": "uuid",
  "status": "created"
}
```

---

#### `DELETE /api/conversations/{conversation_id}`
Delete a conversation and all its messages.

**Response**:
```json
{
  "status": "deleted"
}
```

---

#### `GET /api/conversations/{conversation_id}/messages`
Get all messages for a conversation.

**Response**: `Message[]`

---

#### `DELETE /api/conversations/{conversation_id}/messages`
Clear all messages in a conversation (keep conversation).

**Response**:
```json
{
  "status": "cleared"
}
```

---

#### `POST /api/chat`
Send a message and receive streaming response.

**Request Body** (form-data):
- `prompt`: string (required)
- `conversation_id`: string (required)
- `model`: string (optional, defaults to system default)

**Response**: `text/plain` streaming response

The response streams text chunks as the AI generates them. Client should read using streaming/chunked transfer.

---

#### `GET /health`
Health check endpoint.

**Response**:
```json
{
  "status": "ok"
}
```

---

## Data Model

### Database Schema

```sql
-- Conversations
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,           -- UUID
    title TEXT NOT NULL,           -- First message or "New Chat"
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- Messages
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,            -- 'user' or 'assistant'
    content TEXT NOT NULL,
    model TEXT,                    -- Model used (for assistant messages)
    timestamp TIMESTAMP NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
```

---

## User Flows

### Flow 1: First Visit
1. User opens app
2. Empty sidebar (no conversations)
3. Main area shows empty state
4. User clicks "+ New Chat" or just starts typing
5. Conversation created automatically on first message

### Flow 2: Send Message
1. User types in textarea
2. User presses Enter or clicks Send
3. User message appears immediately
4. Input disabled, typing indicator shown
5. AI response streams in real-time
6. Typing indicator hidden, input re-enabled
7. Conversation list updated (title from first message)

### Flow 3: Switch Model Mid-Conversation
1. User has ongoing conversation
2. User selects different model from dropdown
3. User sends next message
4. New message uses selected model
5. Previous context still available to new model

### Flow 4: Switch Conversation
1. User clicks conversation in sidebar
2. Messages area clears and loads selected conversation
3. Conversation highlighted in sidebar

### Flow 5: Delete Conversation
1. User hovers over conversation in sidebar
2. Delete (×) button appears
3. User clicks delete
4. Conversation removed from list
5. If active conversation deleted, main area shows empty state

---

## System Prompt

The AI assistant uses this system prompt:

```
You are Lucy, a helpful AI assistant.

You are friendly, concise, and helpful. You provide clear and accurate responses.

Guidelines:
- Be direct and helpful
- If you don't know something, say so
- Keep responses focused and relevant
```

System prompt should be configurable.

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key | For OpenAI models |
| `ANTHROPIC_API_KEY` | Anthropic API key | For Claude models |
| `GOOGLE_API_KEY` | Google AI API key | For Gemini models |

---

## Future Enhancements (Not in MVP)

### Phase 2
- [ ] Markdown rendering in messages
- [ ] Code syntax highlighting
- [ ] Copy message button
- [ ] Regenerate response button
- [ ] Edit user message
- [ ] Conversation search
- [ ] Export conversation (JSON/Markdown)

### Phase 3
- [ ] User authentication
- [ ] Multiple users with separate data
- [ ] Conversation sharing
- [ ] Custom system prompts per conversation
- [ ] File uploads (images, documents)
- [ ] Tool/function calling support

### Phase 4
- [ ] Mobile responsive design
- [ ] PWA support
- [ ] Keyboard shortcuts
- [ ] Light/dark theme toggle
- [ ] Model usage analytics
- [ ] Rate limiting

---

## Technical Requirements

### Performance
- Streaming response latency < 200ms to first token
- UI remains responsive during streaming
- Conversation list loads < 100ms
- Message history loads < 200ms for 100 messages

### Reliability
- Graceful handling of AI API failures
- Retry logic for transient errors (2 retries)
- Clear error messages to user
- No data loss on browser refresh

### Security
- API keys stored server-side only
- XSS prevention (escape user content)
- No sensitive data in URLs
- HTTPS in production

---

## Acceptance Criteria

### Must Have
- [x] Create new conversation
- [x] Send message and receive streaming response
- [x] Switch between conversations
- [x] Delete conversation
- [x] Persist conversations across sessions
- [x] Select model per message
- [x] List available models from backend
- [x] Auto-scroll on new messages
- [x] Typing indicator during streaming
- [x] Disable input during streaming

### Should Have
- [ ] Conversation title from first message
- [ ] Error handling with user feedback
- [ ] Loading states

### Nice to Have
- [ ] Markdown rendering
- [ ] Code highlighting
- [ ] Mobile layout
