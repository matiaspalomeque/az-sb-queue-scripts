import { ServiceBusClient, ServiceBusReceiver } from "@azure/service-bus";

const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
const sourceQueue = process.env.SOURCE_QUEUE;
const destQueue = process.env.DEST_QUEUE;
const receiveMessagesCount = Number(process.env.RECEIVE_MESSAGES_COUNT);
const maxWaitTimeInMs = Number(process.env.MAX_WAIT_TIME_IN_MS);

if (!connectionString) throw new Error("SERVICE_BUS_CONNECTION_STRING is required");
if (!sourceQueue) throw new Error("SOURCE_QUEUE is required");
if (!destQueue) throw new Error("DEST_QUEUE is required");

const sbClient = new ServiceBusClient(connectionString);
const sender = sbClient.createSender(destQueue);

async function moveMessages(receiver: ServiceBusReceiver, queueType: string) {
  let totalMoved = 0;

  while (true) {
    const messages = await receiver.receiveMessages(receiveMessagesCount, { maxWaitTimeInMs: maxWaitTimeInMs });
    if (messages.length === 0) break;

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

    for (const msg of messages) {
      await receiver.completeMessage(msg);
    }

    totalMoved += messages.length;
    console.log(`Moved ${messages.length} messages so far... (Total in batch: ${totalMoved})`);
  }

  console.log(`🚚 Moved ${totalMoved} messages from ${queueType}`);
  await receiver.close();
}

async function moveAllMessages() {
  const mode = process.argv[2]?.toLowerCase() || 'both';

  if (!['normal', 'dlq', 'both'].includes(mode)) {
    console.error('❌ Invalid mode. Use "normal", "dlq", or "both" (default).');
    process.exit(1);
  }

  try {
    console.log('🚀 Starting move process...');
    
    if (mode === 'normal' || mode === 'both') {
      console.log('🔄 Processing normal queue...');
      const normalReceiver = sbClient.createReceiver(sourceQueue!);
      await moveMessages(normalReceiver, 'normal queue');
    }

    if (mode === 'dlq' || mode === 'both') {
      console.log('🔄 Processing DLQ...');
      const dlqReceiver = sbClient.createReceiver(sourceQueue!, { subQueueType: "deadLetter" });
      await moveMessages(dlqReceiver, 'dead letter queue');
    }

    await sender.close();
    await sbClient.close();
    console.log('✅ All messages moved successfully');
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

moveAllMessages().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});