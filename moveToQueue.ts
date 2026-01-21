import { ServiceBusClient, ServiceBusReceiver, ServiceBusSender } from "@azure/service-bus";

const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
const sourceQueue = process.env.SOURCE_QUEUE;
const destQueue = process.env.DEST_QUEUE;
const receiveMessagesCount = Number(process.env.RECEIVE_MESSAGES_COUNT) || 100;
const maxWaitTimeInMs = Number(process.env.MAX_WAIT_TIME_IN_MS) || 5000;

if (!connectionString) throw new Error("SERVICE_BUS_CONNECTION_STRING is required");
if (!sourceQueue) throw new Error("SOURCE_QUEUE is required");
if (!destQueue) throw new Error("DEST_QUEUE is required");

const sbClient = new ServiceBusClient(connectionString);
const sender = sbClient.createSender(destQueue);

async function moveMessages(receiver: ServiceBusReceiver, queueType: string) {
  let totalMoved = 0;
  const startTime = Date.now();

  console.log(`\n🚀 Starting to move messages from ${queueType}...`);
  console.log(`   Batch size: ${receiveMessagesCount}, Max wait: ${maxWaitTimeInMs}ms`);

  try {
    while (true) {
      const batchStartTime = Date.now();
      const messages = await receiver.receiveMessages(receiveMessagesCount, { maxWaitTimeInMs });

      if (messages.length === 0) {
        console.log(`\n✨ No more messages found in ${queueType}.`);
        break;
      }

      const newMessages = messages.map(m => ({
        body: m.body,
        contentType: m.contentType,
        correlationId: m.correlationId,
        subject: m.subject,
        applicationProperties: m.applicationProperties,
        messageId: m.messageId,
        to: m.to,
        replyTo: m.replyTo,
        sessionId: m.sessionId,
        timeToLive: m.timeToLive,
      }));

      await sender.sendMessages(newMessages);

      await Promise.all(messages.map(msg => receiver.completeMessage(msg)));

      totalMoved += messages.length;
      
      const batchDuration = (Date.now() - batchStartTime) / 1000;
      const totalDuration = (Date.now() - startTime) / 1000;
      const currentRate = Math.round(messages.length / batchDuration);
      const overallRate = Math.round(totalMoved / totalDuration);

      process.stdout.write(`\r📦 Moved: ${totalMoved} | Last Batch: ${messages.length} (${currentRate} msg/s) | Avg Rate: ${overallRate} msg/s`);
    }
  } catch (err) {
    console.error(`\n❌ Error moving messages from ${queueType}:`, err);
    throw err;
  } finally {
    const totalDuration = (Date.now() - startTime) / 1000;
    console.log(`\n✅ Finished ${queueType}. Total moved: ${totalMoved} in ${totalDuration.toFixed(1)}s`);
    await receiver.close();
  }
}

async function moveAllMessages() {
  const mode = process.argv[2]?.toLowerCase() || 'both';

  if (!['normal', 'dlq', 'both'].includes(mode)) {
    console.error('❌ Invalid mode. Use "normal", "dlq", or "both" (default).');
    process.exit(1);
  }

  try {
    if (mode === 'normal' || mode === 'both') {
      const normalReceiver = sbClient.createReceiver(sourceQueue!);
      await moveMessages(normalReceiver, 'normal queue');
    }

    if (mode === 'dlq' || mode === 'both') {
      const dlqReceiver = sbClient.createReceiver(sourceQueue!, { subQueueType: "deadLetter" });
      await moveMessages(dlqReceiver, 'dead letter queue');
    }

  } catch (error) {
    console.error('\n💥 Fatal Error:', error);
    process.exit(1);
  } finally {
    console.log('\n😴 Closing connections...');
    await sender.close();
    await sbClient.close();
    console.log('👋 Done.');
  }
}

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});

moveAllMessages();