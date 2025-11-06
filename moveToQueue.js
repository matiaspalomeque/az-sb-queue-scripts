import { ServiceBusClient } from "@azure/service-bus";

const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
const sourceQueue = process.env.SOURCE_QUEUE;
const destQueue = process.env.DEST_QUEUE;

if (!connectionString) {
  throw new Error("SERVICE_BUS_CONNECTION_STRING environment variable is required");
}

const sbClient = new ServiceBusClient(connectionString);
const sender = sbClient.createSender(destQueue);

async function moveMessages(receiver, queueType) {
  let totalMoved = 0;
  
  while (true) {
    const messages = await receiver.receiveMessages(25, { maxWaitTimeInMs: 5000 });
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
      label: m.label,
      sessionId: m.sessionId,
      timeToLive: m.timeToLive,
    }));

    await sender.sendMessages(newMessages);

    for (const msg of messages) {
      await receiver.completeMessage(msg);
    }
    
    totalMoved += messages.length;
  }
  
  console.log(`Movidos ${totalMoved} mensajes desde ${queueType}`);
  await receiver.close();
}

async function moveAllMessages() {
  try {
    console.log('Procesando cola normal...');
    const normalReceiver = sbClient.createReceiver(sourceQueue);
    await moveMessages(normalReceiver, 'normal queue');

    console.log('Procesando cola de dead-letters ...');
    const dlqReceiver = sbClient.createReceiver(sourceQueue, { subQueueType: "deadLetter" });
    await moveMessages(dlqReceiver, 'dead letter queue');

    await sender.close();
    await sbClient.close();
    console.log('Todos los mensajes han sido movidos con éxito');
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

moveAllMessages().catch(console.error);