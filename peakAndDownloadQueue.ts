import { ServiceBusClient, ServiceBusReceiver } from "@azure/service-bus";
import * as fs from "fs";
import * as path from "path";

const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;

if (!connectionString) throw new Error("SERVICE_BUS_CONNECTION_STRING is required");

const sbClient = new ServiceBusClient(connectionString);

async function peekMessages(receiver: ServiceBusReceiver, count: number, queueTypeLabel: string): Promise<any[]> {
  console.log(`\n👀 Peeking ${count} messages from ${queueTypeLabel}...`);
  try {
    const messages = await receiver.peekMessages(count);
    console.log(`✨ Found ${messages.length} messages in ${queueTypeLabel}.`);
    
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
      _queueType: queueTypeLabel
    }));
  } catch (err) {
    console.error(`❌ Error peeking messages from ${queueTypeLabel}:`, err);
    return [];
  }
}

async function run() {
  const queueName = process.argv[2];
  const countArg = process.argv[3];
  const typeArg = process.argv[4]?.toLowerCase() || 'dlq';

  if (!queueName) {
    console.error('❌ Usage: bun run peakAndDownloadQueue.ts <queue-name> [count] [type: dlq|normal|both]');
    console.error('   Example: bun run peakAndDownloadQueue.ts my-queue 10 dlq');
    process.exit(1);
  }

  const count = countArg ? parseInt(countArg, 10) : 10;
  if (isNaN(count)) {
    console.error('❌ Invalid count argument.');
    process.exit(1);
  }

  if (!['normal', 'dlq', 'both'].includes(typeArg)) {
    console.error('❌ Invalid type. Use "normal", "dlq", or "both" (default is "dlq").');
    process.exit(1);
  }

  const allMessages: any[] = [];

  try {
    if (typeArg === 'normal' || typeArg === 'both') {
      const receiver = sbClient.createReceiver(queueName);
      const messages = await peekMessages(receiver, count, 'Normal Queue');
      allMessages.push(...messages);
      await receiver.close();
    }

    if (typeArg === 'dlq' || typeArg === 'both') {
      const receiver = sbClient.createReceiver(queueName, { subQueueType: "deadLetter" });
      const messages = await peekMessages(receiver, count, 'Dead Letter Queue');
      allMessages.push(...messages);
      await receiver.close();
    }

    if (allMessages.length > 0) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `messages-${queueName}-${typeArg}-${timestamp}.json`;
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
