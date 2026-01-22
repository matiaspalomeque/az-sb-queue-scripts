import { ServiceBusClient, ServiceBusReceiver } from "@azure/service-bus";
import Long from "long";

const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
const batchSize = Number(process.env.BATCH_SIZE) || 100;
const caseSensitive = process.env.CASE_SENSITIVE === "true";

if (!connectionString) throw new Error("SERVICE_BUS_CONNECTION_STRING is required");

const sbClient = new ServiceBusClient(connectionString);

async function searchMessages(receiver: ServiceBusReceiver, queueType: string, searchString: string) {
  let totalChecked = 0;
  let matchesFound = 0;
  let fromSequenceNumber = Long.ZERO;
  const startTime = Date.now();

  console.log(`\n🔍 Searching ${queueType}...`);
  console.log(`   Looking for: "${searchString}" (caseSensitive=${caseSensitive})`);

  try {
    while (true) {
      const messages = await receiver.peekMessages(batchSize, {
        fromSequenceNumber: fromSequenceNumber
      });

      if (messages.length === 0) {
        console.log(`\n✨ No more messages found in ${queueType}.`);
        break;
      }

      for (const msg of messages) {
        totalChecked++;

        let bodyStr = "";
        if (Buffer.isBuffer(msg.body)) {
          bodyStr = msg.body.toString("utf-8");
        } else if (typeof msg.body === "string") {
          bodyStr = msg.body;
        } else {
          bodyStr = JSON.stringify(msg.body);
        }

        const contains = caseSensitive
          ? bodyStr.includes(searchString)
          : bodyStr.toLowerCase().includes(searchString.toLowerCase());

        if (contains) {
          matchesFound++;
          console.log(`\n🎯 MATCH # ${matchesFound}`);
          console.log(`   MessageId: ${msg.messageId}`);
          console.log(`   SequenceNumber: ${msg.sequenceNumber}`);
          console.log(`   Enqueued: ${msg.enqueuedTimeUtc}`);
          if (msg.deadLetterReason) {
             console.log(`   DeadLetter Reason: ${msg.deadLetterReason}`);
             console.log(`   DeadLetter Error: ${msg.deadLetterErrorDescription}`);
          }
          console.log(`   Body Preview: ${bodyStr.substring(0, 300)}${bodyStr.length > 300 ? "..." : ""}`);
        }

        fromSequenceNumber = msg.sequenceNumber!.add(1);
      }
      
      process.stdout.write(`\r👀 Checked: ${totalChecked} | Matches: ${matchesFound}`);
    }
  } catch (err) {
    console.error(`\n❌ Error searching ${queueType}:`, err);
    throw err;
  } finally {
    const totalDuration = (Date.now() - startTime) / 1000;
    console.log(`\n✅ Finished ${queueType}. Checked: ${totalChecked}, Matches: ${matchesFound} in ${totalDuration.toFixed(1)}s`);
    await receiver.close();
  }
}

async function searchAllMessages() {
  const queue = process.argv[2];
  const searchString = process.argv[3];
  const mode = process.argv[4]?.toLowerCase() || 'both';

  if (!queue || !searchString) {
    console.error('❌ Usage: bun run searchInQueue.ts <queue> <search-string> [normal|dlq|both]');
    process.exit(1);
  }

  if (!['normal', 'dlq', 'both'].includes(mode)) {
    console.error('❌ Invalid mode. Use "normal", "dlq", or "both" (default).');
    process.exit(1);
  }

  try {
    if (mode === 'normal' || mode === 'both') {
      const normalReceiver = sbClient.createReceiver(queue);
      await searchMessages(normalReceiver, 'normal queue', searchString);
    }

    if (mode === 'dlq' || mode === 'both') {
      const dlqReceiver = sbClient.createReceiver(queue, { subQueueType: "deadLetter" });
      await searchMessages(dlqReceiver, 'dead letter queue', searchString);
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

searchAllMessages();