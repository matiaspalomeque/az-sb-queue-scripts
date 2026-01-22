import { ServiceBusClient, ServiceBusReceiver } from "@azure/service-bus";

const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
const receiveMessagesCount = Number(process.env.RECEIVE_MESSAGES_COUNT) || 100;
const maxWaitTimeInMs = Number(process.env.MAX_WAIT_TIME_IN_MS) || 5000;

if (!connectionString) throw new Error("SERVICE_BUS_CONNECTION_STRING is required");

const sbClient = new ServiceBusClient(connectionString);

async function emptyMessages(receiver: ServiceBusReceiver, queueType: string) {
  let totalDeleted = 0;
  const startTime = Date.now();

  console.log(`\n🚀 Starting to empty ${queueType}...`);
  console.log(`   Batch size: ${receiveMessagesCount}, Max wait: ${maxWaitTimeInMs}ms`);

  try {
    while (true) {
      const batchStartTime = Date.now();
      const messages = await receiver.receiveMessages(receiveMessagesCount, { maxWaitTimeInMs });

      if (messages.length === 0) {
        console.log(`\n✨ No more messages found in ${queueType}.`);
        break;
      }

      await Promise.all(messages.map(m => receiver.completeMessage(m)));

      totalDeleted += messages.length;
      
      const batchDuration = (Date.now() - batchStartTime) / 1000;
      const totalDuration = (Date.now() - startTime) / 1000;
      const currentRate = Math.round(messages.length / batchDuration);
      const overallRate = Math.round(totalDeleted / totalDuration);

      process.stdout.write(`\r🗑️  Deleted: ${totalDeleted} | Last Batch: ${messages.length} (${currentRate} msg/s) | Avg Rate: ${overallRate} msg/s`);
    }
  } catch (err) {
    console.error(`\n❌ Error emptying ${queueType}:`, err);
    throw err;
  } finally {
    const totalDuration = (Date.now() - startTime) / 1000;
    console.log(`\n✅ Finished ${queueType}. Total deleted: ${totalDeleted} in ${totalDuration.toFixed(1)}s`);
    await receiver.close();
  }
}

async function emptyAllMessages() {
  const queue = process.argv[2];
  const mode = process.argv[3]?.toLowerCase() || 'both';

  if (!queue) {
    console.error('❌ Usage: bun run emptyQueue.ts <queue> [normal|dlq|both]');
    process.exit(1);
  }

  if (!['normal', 'dlq', 'both'].includes(mode)) {
    console.error('❌ Invalid mode. Use "normal", "dlq", or "both" (default).');
    process.exit(1);
  }

  try {
    if (mode === 'normal' || mode === 'both') {
      const normalReceiver = sbClient.createReceiver(queue);
      await emptyMessages(normalReceiver, 'normal queue');
    }

    if (mode === 'dlq' || mode === 'both') {
      const dlqReceiver = sbClient.createReceiver(queue, { subQueueType: "deadLetter" });
      await emptyMessages(dlqReceiver, 'dead letter queue');
    }

  } catch (error) {
    console.error('\n💥 Fatal Error:', error);
    process.exit(1);
  } finally {
    console.log('\n😴 Closing connections...');
    await sbClient.close();
    console.log('👋 Done.');
  }
}

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});

emptyAllMessages();