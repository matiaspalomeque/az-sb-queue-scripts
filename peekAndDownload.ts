import { ServiceBusClient, ServiceBusReceiver } from "@azure/service-bus";
import * as fs from "fs";
import * as path from "path";

const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;

if (!connectionString) throw new Error("SERVICE_BUS_CONNECTION_STRING is required");

const sbClient = new ServiceBusClient(connectionString);

async function peekMessages(receiver: ServiceBusReceiver, count: number, sourceLabel: string): Promise<any[]> {
  console.log(`\n👀 Peeking ${count} messages from ${sourceLabel}...`);
  try {
    const messages = await receiver.peekMessages(count);
    console.log(`✨ Found ${messages.length} messages in ${sourceLabel}.`);

    return messages.map(m => ({
      messageId: m.messageId,
      body: m.body,
      subject: m.subject,
      contentType: m.contentType,
      correlationId: m.correlationId,
      partitionKey: m.partitionKey,
      traceParent: m.applicationProperties?.['Diagnostic-Id'],
      applicationProperties: m.applicationProperties,
      enqueuedTimeUtc: m.enqueuedTimeUtc,
      expiresAtUtc: m.expiresAtUtc,
      _source: sourceLabel
    }));
  } catch (err) {
    console.error(`❌ Error peeking messages from ${sourceLabel}:`, err);
    return [];
  }
}

async function run() {
  const firstArg = process.argv[2];
  let entityType: "queue" | "topic";
  let entityName: string;
  let subscriptionName: string | undefined;
  let countArg: string | undefined;
  let typeArg: string | undefined;

  if (firstArg === "queue" || firstArg === "topic") {
    entityType = firstArg;
    entityName = process.argv[3];

    if (entityType === "topic") {
      subscriptionName = process.argv[4];
      countArg = process.argv[5];
      typeArg = process.argv[6];
    } else {
      countArg = process.argv[4];
      typeArg = process.argv[5];
    }
  } else {
    entityType = "queue";
    entityName = firstArg;
    countArg = process.argv[3];
    typeArg = process.argv[4];
  }

  if (!entityName) {
    console.error('❌ Usage:');
    console.error('   OLD: bun run peekAndDownload.ts <queue-name> [count] [type]');
    console.error('   NEW: bun run peekAndDownload.ts queue <queue-name> [count] [type]');
    console.error('   NEW: bun run peekAndDownload.ts topic <topic-name> <subscription-name> [count] [type]');
    console.error('\nExamples:');
    console.error('   bun run peekAndDownload.ts my-queue 10 dlq');
    console.error('   bun run peekAndDownload.ts queue my-queue 10 normal');
    console.error('   bun run peekAndDownload.ts topic my-topic my-subscription 10 both');
    process.exit(1);
  }

  if (entityType === "topic" && !subscriptionName) {
    console.error('❌ Subscription name is required for topics.');
    console.error('   Usage: bun run peekAndDownload.ts topic <topic-name> <subscription-name> [count] [type]');
    process.exit(1);
  }

  const count = countArg ? parseInt(countArg, 10) : 10;
  if (isNaN(count)) {
    console.error('❌ Invalid count argument.');
    process.exit(1);
  }

  const type = typeArg?.toLowerCase() || 'dlq';
  if (!['normal', 'dlq', 'both'].includes(type)) {
    console.error('❌ Invalid type. Use "normal", "dlq", or "both" (default is "dlq").');
    process.exit(1);
  }

  const allMessages: any[] = [];

  try {
    if (type === 'normal' || type === 'both') {
      let receiver: ServiceBusReceiver;
      let sourceLabel: string;

      if (entityType === "queue") {
        receiver = sbClient.createReceiver(entityName);
        sourceLabel = `Normal Queue: ${entityName}`;
      } else {
        receiver = sbClient.createReceiver(entityName, subscriptionName!);
        sourceLabel = `Normal Subscription: ${entityName}/${subscriptionName}`;
      }

      const messages = await peekMessages(receiver, count, sourceLabel);
      allMessages.push(...messages);
      await receiver.close();
    }

    if (type === 'dlq' || type === 'both') {
      let receiver: ServiceBusReceiver;
      let sourceLabel: string;

      if (entityType === "queue") {
        receiver = sbClient.createReceiver(entityName, { subQueueType: "deadLetter" });
        sourceLabel = `Dead Letter Queue: ${entityName}`;
      } else {
        receiver = sbClient.createReceiver(entityName, subscriptionName!, { subQueueType: "deadLetter" });
        sourceLabel = `Dead Letter Subscription: ${entityName}/${subscriptionName}`;
      }

      const messages = await peekMessages(receiver, count, sourceLabel);
      allMessages.push(...messages);
      await receiver.close();
    }

    if (allMessages.length > 0) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      let filename: string;

      if (entityType === "queue") {
        filename = `messages-${entityName}-${type}-${timestamp}.json`;
      } else {
        filename = `messages-${entityName}-${subscriptionName}-${type}-${timestamp}.json`;
      }

      const absolutePath = path.resolve(process.cwd(), filename);

      fs.writeFileSync(absolutePath, JSON.stringify(allMessages, null, 2));
      console.log(`\n✅ Saved ${allMessages.length} messages to:`);
      console.log(`   ${filename}`);
    } else {
      console.log('\n⚠️ No messages found to save.');
    }

  } catch (error) {
    console.error('\n💥 Fatal Error:', error);
    process.exit(1);
  } finally {
    await sbClient.close();
  }
}

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});

run();
