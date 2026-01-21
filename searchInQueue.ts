import { ServiceBusClient } from "@azure/service-bus";
import Long from "long";

if (process.argv.length < 3) {
  console.error("Usage: bun run searchInQueue.ts <search-string> [queue-name]");
  console.error("Example: bun run searchInQueue.ts \"Something12345\" my-queue");
  process.exit(1);
}

const searchString = process.argv[2];
const queueName = process.argv[3] || process.env.SOURCE_QUEUE;

const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
const batchSize = Number(process.env.BATCH_SIZE) || 100;
const caseSensitive = process.env.CASE_SENSITIVE === "true";

if (!connectionString) {
  console.error("ERROR: SERVICE_BUS_CONNECTION_STRING environment variable is required");
  process.exit(1);
}
if (!queueName) {
  console.error("ERROR: Queue name must be provided via argument or QUEUE_NAME env var");
  process.exit(1);
}

const sbClient = new ServiceBusClient(connectionString);

async function searchQueue(isDlq = false) {
  const receiverOptions = isDlq ? {
    subQueueType: "deadLetter" as const,
    receiveMode: "peekLock" as const
  } : {
    receiveMode: "peekLock" as const
  };

  const receiver = sbClient.createReceiver(queueName!, receiverOptions);

  let totalChecked = 0;
  let matchesFound = 0;
  let fromSequenceNumber = Long.ZERO;

  const queueLabel = isDlq ? `DLQ of queue "${queueName}"` : `queue "${queueName}"`;

  console.log(`\n🔍 Searching ${queueLabel}`);
  console.log(`Looking for: "${searchString}" (caseSensitive = ${caseSensitive})\n`);

  try {
    while (true) {
      const messages = await receiver.peekMessages(batchSize, {
        fromSequenceNumber: fromSequenceNumber
      });

      if (messages.length === 0) {
        console.log(`🤷 No more messages found in ${isDlq ? "DLQ" : "queue"}.\n`);
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
          console.log(`🎯 MATCH #${matchesFound}`);
          console.log(`   MessageId            : ${msg.messageId}`);
          console.log(`   SequenceNumber       : ${msg.sequenceNumber}`);
          console.log(`   Enqueued             : ${msg.enqueuedTimeUtc}`);
          if (isDlq) {
            console.log(`   DeadLetter Reason    : ${msg.deadLetterReason || "N/A"}`);
            console.log(`   DeadLetter Error     : ${msg.deadLetterErrorDescription || "N/A"}`);
          }
          console.log(`   Body preview         : ${bodyStr.substring(0, 300)}${bodyStr.length > 300 ? "..." : ""}\n`);
        }

        fromSequenceNumber = msg.sequenceNumber!.add(1);
      }

      console.log(`Batch processed: ${messages.length} messages → Total checked: ${totalChecked} | Matches so far: ${matchesFound}`);
    }
  } catch (err) {
    console.error("Error during processing:", err);
    throw err;
  } finally {
    await receiver.close();
  }

  console.log(`=== 📊 SUMMARY for ${queueLabel} ===`);
  console.log(`Total messages checked : ${totalChecked}`);
  console.log(`Matches found          : ${matchesFound}`);
  if (matchesFound === 0) {
    console.log(`🤷 No messages in the ${isDlq ? "DLQ" : "queue"} contain "${searchString}"`);
  }

  return { totalChecked, matchesFound };
}

async function main() {
  console.log("🚀 Starting search...");

  const mainResult = await searchQueue(false);

  const dlqResult = await searchQueue(true);

  console.log("\n\n==========================================");
  console.log("           📊 OVERALL SUMMARY");
  console.log("==========================================");
  console.log(`Main Queue: ${mainResult.matchesFound} matches found in ${mainResult.totalChecked} messages.`);
  console.log(`DLQ       : ${dlqResult.matchesFound} matches found in ${dlqResult.totalChecked} messages.`);
  console.log("==========================================");
}

main()
  .catch(console.error)
  .finally(async () => {
    await sbClient.close();
  });