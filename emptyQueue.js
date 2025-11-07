import 'dotenv/config';
import { ServiceBusClient } from "@azure/service-bus";

const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
const sourceQueue = process.env.SOURCE_QUEUE;
const receiveMessagesCount = Number(process.env.RECEIVE_MESSAGES_COUNT);
const maxWaitTimeInMs = Number(process.env.MAX_WAIT_TIME_IN_MS);

const client   = new ServiceBusClient(connectionString);
const receiver = client.createReceiver(sourceQueue);

async function empty() {
  let total = 0;
  console.log("Limpiando la cola… (Ctrl-C para detener)");

  while (true) {
    const msgs = await receiver.receiveMessages(receiveMessagesCount, { maxWaitTimeInMs: maxWaitTimeInMs });
    if (!msgs.length) {
      console.log("La cola está vacía");
      break;
    }

    await Promise.all(msgs.map(m => receiver.completeMessage(m)));
    total += msgs.length;
    process.stdout.write(`\r${total} mensajes eliminados…`);
  }

  await receiver.close();
  await client.close();
}

empty().catch(console.error);