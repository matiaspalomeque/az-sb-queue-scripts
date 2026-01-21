import { ServiceBusClient } from "@azure/service-bus";

const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
const sourceQueue = process.env.SOURCE_QUEUE;
const receiveMessagesCount = Number(process.env.RECEIVE_MESSAGES_COUNT);
const maxWaitTimeInMs = Number(process.env.MAX_WAIT_TIME_IN_MS);

if (!connectionString) throw new Error("SERVICE_BUS_CONNECTION_STRING is required");
if (!sourceQueue) throw new Error("SOURCE_QUEUE is required");

const client = new ServiceBusClient(connectionString);
const receiver = client.createReceiver(sourceQueue);

async function empty() {
  let total = 0;
  console.log("🚀 Clearing queue... (Ctrl-C to stop)");

  while (true) {
    const msgs = await receiver.receiveMessages(receiveMessagesCount, { maxWaitTimeInMs: maxWaitTimeInMs });
    if (!msgs.length) {
      console.log("\n📭 The queue is empty");
      break;
    }

    await Promise.all(msgs.map(m => receiver.completeMessage(m)));
    total += msgs.length;
    process.stdout.write(`\r🗑️  ${total} messages deleted...`);
  }

  await receiver.close();
  await client.close();
  console.log(`\n✅ Finished. Total deleted: ${total}`);
}

empty().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});