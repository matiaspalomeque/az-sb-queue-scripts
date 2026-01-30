# Azure Service Bus Queue Utilities

![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-3178C6?logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-1.3+-F9F1E1?logo=bun&logoColor=black)
![Azure Service Bus](https://img.shields.io/badge/Azure-Service%20Bus-0078D4?logo=microsoftazure&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-24+-339933?logo=node.js&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

> Fast, efficient command-line utilities for managing Azure Service Bus queues and topics with real-time progress tracking

## Overview

A collection of TypeScript command-line tools designed for troubleshooting, migrating, and auditing Azure Service Bus queues and topics. These utilities provide fast batch processing with parallel message completion, real-time progress reporting (messages per second), and comprehensive support for both normal queues and dead letter queues (DLQs).

Perfect for DevOps engineers, platform teams, and developers who need to quickly inspect, move, or clean up messages in Azure Service Bus.

## Features

- **Real-time Progress Tracking** - Live updates with current and average msg/s rates
- **Batch Processing** - Configurable batch sizes with parallel message completion for maximum throughput
- **Dead Letter Queue Support** - Operate on normal queues, DLQs, or both with a single command
- **Non-Destructive Peeking** - Inspect messages without removing them, export to JSON
- **Topic & Subscription Support** - Peek messages from topic subscriptions (peekAndDownload only)
- **Message Property Preservation** - Maintains all message metadata during move operations
- **Multi-Environment Support** - Manage multiple Azure Service Bus namespaces with separate .env files
- **Case-Insensitive Search** - Flexible message body searching with configurable case sensitivity

## Prerequisites

- **Bun 1.3+** (recommended) or **Node.js 24+**
- Azure Service Bus namespace with connection string
- Required permissions: **Manage**, **Send**, and **Listen** on target queues/topics
- TypeScript 5.9+ (included in devDependencies)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/az-sb-queue-scripts.git
   cd az-sb-queue-scripts
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your Azure Service Bus connection string:
   ```env
   SERVICE_BUS_CONNECTION_STRING=Endpoint=sb://your-namespace.servicebus.windows.net/;SharedAccessKeyName=...
   RECEIVE_MESSAGES_COUNT=25
   MAX_WAIT_TIME_IN_MS=5000
   CASE_SENSITIVE=false
   ```

4. **Verify installation**
   ```bash
   bun run peekAndDownload.ts --help
   ```

## Quick Start

Here are the most common operations to get you started:

```bash
# Peek 10 messages from a queue's DLQ (non-destructive)
bun run peekAndDownload.ts my-queue 10 dlq

# Empty a dead letter queue
bun run emptyQueue.ts my-queue dlq

# Search for messages containing "OrderId: 12345"
bun run searchInQueue.ts my-queue "OrderId: 12345"

# Move messages from DLQ back to the main queue
bun run moveToQueue.ts my-queue my-queue dlq
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVICE_BUS_CONNECTION_STRING` | *(required)* | Azure Service Bus connection string |
| `RECEIVE_MESSAGES_COUNT` | `25` | Batch size for empty/move operations (100 for move by default) |
| `MAX_WAIT_TIME_IN_MS` | `5000` | Maximum wait time when receiving messages |
| `CASE_SENSITIVE` | `false` | Enable case-sensitive search matching |
| `BATCH_SIZE` | `100` | Batch size for search operations (not applicable to peek, which uses 250 max) |

### Multiple Environment Files

Manage multiple Azure Service Bus namespaces by creating environment-specific files:

```bash
.env.production.PROD
.env.staging.DEV
.env.indexing.PROD
```

Load a specific environment file before running commands:

```bash
# Load production environment
export $(cat .env.production.PROD | xargs) && bun run peekAndDownload.ts my-queue
```

## Usage

### Empty Queue

Delete messages from queues or dead letter queues. Messages are permanently removed.

**Syntax:**
```bash
bun run emptyQueue.ts <queue-name> [mode]
```

**Arguments:**
- `queue-name` (required) - Name of the queue
- `mode` (optional) - `normal`, `dlq`, or `both` (default: `both`)

**Examples:**

```bash
# Empty both normal queue and DLQ
bun run emptyQueue.ts payment-queue

# Empty only the dead letter queue
bun run emptyQueue.ts payment-queue dlq

# Empty only the normal queue
bun run emptyQueue.ts payment-queue normal

# Using npm script
bun run empty-queue-node
```

**Sample Output:**
```
🚀 Starting to empty dead letter queue...
   Batch size: 100, Max wait: 5000ms
🗑️  Deleted: 247 | Last Batch: 100 (182 msg/s) | Avg Rate: 165 msg/s
✨ No more messages found in dead letter queue.
✅ Finished dead letter queue. Total deleted: 247 in 1.5s
```

### Move Messages Between Queues

Move messages from one queue to another, preserving all message properties and metadata.

**Syntax:**
```bash
bun run moveToQueue.ts <source-queue> <dest-queue> [mode]
```

**Arguments:**
- `source-queue` (required) - Source queue name
- `dest-queue` (required) - Destination queue name
- `mode` (optional) - `normal`, `dlq`, or `both` (default: `both`)

**Preserved Properties:**
- body, contentType, correlationId, subject, applicationProperties
- messageId, to, replyTo, sessionId, timeToLive

**Examples:**

```bash
# Move all messages from source-queue to dest-queue (both normal and DLQ)
bun run moveToQueue.ts source-queue dest-queue

# Move only from dead letter queue to main queue (reprocess failed messages)
bun run moveToQueue.ts failed-orders failed-orders dlq

# Move only from normal queue
bun run moveToQueue.ts old-queue new-queue normal

# Using npm script
bun run move-to-queue-node
```

**Sample Output:**
```
🚀 Starting to move messages from dead letter queue...
   Batch size: 100, Max wait: 5000ms
📦 Moved: 156 | Last Batch: 56 (124 msg/s) | Avg Rate: 118 msg/s
✨ No more messages found in dead letter queue.
✅ Finished dead letter queue. Total moved: 156 in 1.3s
```

### Search Messages

Search message bodies for a specific string without modifying messages. Supports case-sensitive and case-insensitive matching.

**Syntax:**
```bash
bun run searchInQueue.ts <queue-name> <search-string> [mode]
```

**Arguments:**
- `queue-name` (required) - Name of the queue
- `search-string` (required) - String to search for in message bodies
- `mode` (optional) - `normal`, `dlq`, or `both` (default: `both`)

**Examples:**

```bash
# Search in both normal queue and DLQ
bun run searchInQueue.ts orders-queue "OrderId: 12345"

# Search only in dead letter queue
bun run searchInQueue.ts orders-queue "error" dlq

# Case-sensitive search (set CASE_SENSITIVE=true in .env)
bun run searchInQueue.ts orders-queue "CRITICAL"

# Using npm script
bun run search-in-queue
```

**Sample Output:**
```
🔍 Searching dead letter queue...
   Looking for: "OrderId: 12345" (caseSensitive=false)
👀 Checked: 523 | Matches: 2

🎯 MATCH # 1
   MessageId: abc-123-def-456
   SequenceNumber: 1234567890
   Enqueued: 2026-01-30T10:15:30.000Z
   DeadLetter Reason: MaxDeliveryCountExceeded
   DeadLetter Error: Message exceeded max delivery attempts
   Body Preview: {"OrderId": "12345", "CustomerId": "xyz", "Amount": 150.00, "Status": "failed"}

✅ Finished dead letter queue. Checked: 523, Matches: 2 in 3.2s
```

### Peek and Download Messages

Non-destructive read of messages that exports to a JSON file. Messages remain in the queue unchanged. Supports both queues and topics.

**Syntax:**
```bash
# Queues (short form)
bun run peekAndDownload.ts <queue-name> [count] [mode]

# Queues (explicit)
bun run peekAndDownload.ts queue <queue-name> [count] [mode]

# Topics
bun run peekAndDownload.ts topic <topic-name> <subscription-name> [count] [mode]
```

**Arguments:**
- `queue-name` or `topic-name` (required) - Entity name
- `subscription-name` (required for topics) - Subscription name
- `count` (optional) - Number of messages to peek (default: `10`)
- `mode` (optional) - `normal`, `dlq`, or `both` (default: `dlq`)

**Examples:**

```bash
# Peek 10 messages from queue DLQ (default)
bun run peekAndDownload.ts payment-queue

# Peek 50 messages from queue DLQ
bun run peekAndDownload.ts payment-queue 50 dlq

# Peek 100 messages from both queue and DLQ
bun run peekAndDownload.ts queue payment-queue 100 both

# Peek 20 messages from topic subscription DLQ
bun run peekAndDownload.ts topic order-events order-processor 20 dlq

# Peek from normal topic subscription
bun run peekAndDownload.ts topic order-events order-processor 10 normal

# Using npm script
bun run peek-and-download
```

**Sample Output:**
```
👀 Peeking 50 messages from Dead Letter Queue: payment-queue...
   Retrieved: 50 messages...
✨ Found 50 messages in Dead Letter Queue: payment-queue.

✅ Saved 50 messages to:
   messages-payment-queue-dlq-2026-01-30T14-23-45-123Z.json
```

**JSON Output Format:**

Messages are saved with the naming convention: `messages-{entity-name}[-{subscription}]-{mode}-{timestamp}.json`

Example file structure:
```json
[
  {
    "messageId": "abc-123-def-456",
    "body": {
      "OrderId": "12345",
      "CustomerId": "xyz",
      "Amount": 150.00
    },
    "subject": "order.created",
    "contentType": "application/json",
    "correlationId": "correlation-123",
    "partitionKey": null,
    "traceParent": "00-trace-id-span-id-00",
    "applicationProperties": {
      "Source": "OrderService",
      "Version": "1.0"
    },
    "enqueuedTimeUtc": "2026-01-30T10:15:30.000Z",
    "expiresAtUtc": "2026-01-31T10:15:30.000Z",
    "_source": "Dead Letter Queue: payment-queue"
  }
]
```

## Advanced Topics

### Working with Topics and Subscriptions

Currently, only the `peekAndDownload.ts` script supports topics and subscriptions. Other scripts (empty, move, search) operate on queues only.

**Topic Syntax:**
```bash
bun run peekAndDownload.ts topic <topic-name> <subscription-name> [count] [mode]
```

**Limitations:**
- Empty, move, and search operations are **not** supported for topics yet
- To operate on topic subscriptions, treat them as queues by specifying the full path (not currently implemented)

**Future Enhancement:**
Consider extending `emptyQueue.ts`, `moveToQueue.ts`, and `searchInQueue.ts` to accept topic/subscription pairs using the same pattern as `peekAndDownload.ts`.

### Using Multiple Environment Files

Organize connection strings for different environments or namespaces:

**Recommended Structure:**
```
.env.production.PROD
.env.staging.DEV
.env.integration.PROD
.env.indexing.PROD
```

**Load Specific Environment:**
```bash
# Option 1: Export before running
export $(cat .env.production.PROD | xargs)
bun run peekAndDownload.ts my-queue

# Option 2: Inline (Bash)
SERVICE_BUS_CONNECTION_STRING="Endpoint=sb://..." bun run emptyQueue.ts my-queue

# Option 3: Use dotenv-cli (install separately)
dotenv -e .env.production.PROD -- bun run moveToQueue.ts source dest
```

### Performance Tuning

**Batch Size Optimization:**

| Operation | Default Batch Size | Environment Variable | Recommended Range |
|-----------|-------------------|---------------------|-------------------|
| Empty Queue | 100 | `RECEIVE_MESSAGES_COUNT` | 50-500 |
| Move Messages | 100 | `RECEIVE_MESSAGES_COUNT` | 50-500 |
| Search Messages | 100 | `BATCH_SIZE` | 100-250 |
| Peek Messages | 250 (max) | *(hardcoded)* | 1-250 |

**Expected Throughput:**
- Empty operations: 150-300 msg/s (depends on message size and network latency)
- Move operations: 100-200 msg/s (includes send + complete)
- Search operations: 200-500 msg/s (non-destructive, read-only)
- Peek operations: 300-600 msg/s (non-destructive, no locks)

**Tuning Tips:**
- Increase batch size for higher throughput with larger queues
- Decrease batch size to reduce memory usage with very large messages
- Adjust `MAX_WAIT_TIME_IN_MS` to balance speed vs. completeness (lower = faster exit when empty)

### Understanding Queue Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `normal` | Operate only on the main queue | Processing live messages, inspecting active queue |
| `dlq` | Operate only on the dead letter queue | Troubleshooting failures, reprocessing failed messages |
| `both` | Operate on both normal and DLQ sequentially | Complete queue cleanup, comprehensive search |

**Default Modes by Script:**
- `emptyQueue.ts`: `both`
- `moveToQueue.ts`: `both`
- `searchInQueue.ts`: `both`
- `peekAndDownload.ts`: `dlq` (most common troubleshooting scenario)

## Output Examples

### Empty Queue Progress
```
🚀 Starting to empty dead letter queue...
   Batch size: 100, Max wait: 5000ms
🗑️  Deleted: 1247 | Last Batch: 100 (182 msg/s) | Avg Rate: 165 msg/s
✨ No more messages found in dead letter queue.
✅ Finished dead letter queue. Total deleted: 1247 in 7.6s

😴 Closing connections...
👋 Done.
```

### Search Results
```
🔍 Searching dead letter queue...
   Looking for: "OrderId: 12345" (caseSensitive=false)
👀 Checked: 1523 | Matches: 3

🎯 MATCH # 1
   MessageId: msg-abc-123
   SequenceNumber: 8675309
   Enqueued: 2026-01-30T14:23:45.123Z
   DeadLetter Reason: ProcessingError
   DeadLetter Error: Validation failed: Invalid payment method
   Body Preview: {"OrderId":"12345","PaymentMethod":"INVALID","Amount":99.99}

✅ Finished dead letter queue. Checked: 1523, Matches: 3 in 4.8s
```

### Peek and Download JSON File
```json
[
  {
    "messageId": "d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a",
    "body": {
      "EventType": "OrderCreated",
      "OrderId": "ORD-2026-001",
      "Timestamp": "2026-01-30T14:23:45.123Z"
    },
    "subject": "orders.created.v1",
    "contentType": "application/json",
    "correlationId": "corr-123-456",
    "partitionKey": "customer-42",
    "traceParent": "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    "applicationProperties": {
      "Source": "OrderService",
      "Version": "1.2.3",
      "Environment": "production"
    },
    "enqueuedTimeUtc": "2026-01-30T14:23:45.123Z",
    "expiresAtUtc": "2026-02-06T14:23:45.123Z",
    "_source": "Dead Letter Queue: orders-queue"
  }
]
```

## Troubleshooting

### Connection Errors

**Error:** `ServiceBusError: The messaging entity 'sb://namespace.servicebus.windows.net/queue-name' could not be found`

**Solution:**
- Verify the queue/topic name is correct (case-sensitive)
- Ensure the entity exists in the Azure portal
- Check that your connection string points to the correct namespace

### Permission Errors

**Error:** `UnauthorizedAccess: Unauthorized access. 'Listen' claim required`

**Solution:**
- Verify your connection string has **Manage**, **Send**, and **Listen** permissions
- Check the Shared Access Policy in Azure portal
- For production, use connection strings with minimum required permissions per operation

### No Messages Found

**Symptom:** Scripts complete immediately with "No more messages found"

**Possible Causes:**
1. The queue/DLQ is actually empty
2. Messages are locked by another consumer (visible in peek, but not receivable)
3. Wrong mode specified (e.g., searching `normal` when messages are in `dlq`)

**Solution:**
- Try peeking first: `bun run peekAndDownload.ts my-queue 10 both`
- Check Azure portal metrics for message counts
- Try `both` mode to search all queues

### Performance Issues

**Symptom:** Slow message processing (< 50 msg/s)

**Possible Causes:**
1. Batch size too small
2. Network latency to Azure Service Bus
3. Very large message bodies
4. Throttling by Azure Service Bus (Standard tier limits)

**Solution:**
- Increase `RECEIVE_MESSAGES_COUNT` (try 200-500)
- Run from Azure VM in same region as Service Bus namespace
- Check Azure Service Bus metrics for throttling
- Upgrade to Premium tier for higher throughput

### Bun-Specific Issues

**Error:** `error: Cannot find package '@azure/service-bus'`

**Solution:**
```bash
# Clear bun cache and reinstall
rm -rf node_modules bun.lockb
bun install
```

**Falling back to Node.js:**
```bash
# If Bun has issues, use Node.js instead
node --loader ts-node/esm emptyQueue.ts my-queue
```

## Project Structure

```
az-sb-queue-scripts/
├── emptyQueue.ts              # Delete messages from queues/DLQs
├── moveToQueue.ts             # Move messages between queues
├── searchInQueue.ts           # Search message bodies
├── peekAndDownload.ts         # Non-destructive peek with JSON export
├── package.json               # Dependencies and npm scripts
├── tsconfig.json              # TypeScript configuration
├── .env.example               # Environment variable template
├── .gitignore                 # Git ignore rules
├── README.md                  # This file
```

**Notes:**
- All scripts are standalone TypeScript files (no `src/` directory)
- No build step required - run directly with Bun
- Uses ES modules (`"type": "module"` in `package.json`)

## Acknowledgments

Built with:
- [Azure SDK for JavaScript](https://github.com/Azure/azure-sdk-for-js) - Official Azure Service Bus client
- [Bun](https://bun.sh/) - Fast JavaScript runtime and package manager
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript

**Documentation:**
- [Azure Service Bus Documentation](https://learn.microsoft.com/en-us/azure/service-bus-messaging/)
- [Azure Service Bus Node.js SDK Reference](https://learn.microsoft.com/en-us/javascript/api/overview/azure/service-bus)
- [Bun Documentation](https://bun.sh/docs)

---

**Made with ☕ for troubleshooting Azure Service Bus**
