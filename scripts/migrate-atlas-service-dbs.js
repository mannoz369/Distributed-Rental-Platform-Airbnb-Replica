const { MongoClient } = require("mongodb");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has("--write");

const collections = [
  {
    label: "users",
    sourceCollection: "users",
    targetEnvKey: "AUTH_DB_URL",
  },
  {
    label: "listings",
    sourceCollection: "listings",
    targetEnvKey: "LISTING_DB_URL",
  },
  {
    label: "bookings",
    sourceCollection: "bookings",
    targetEnvKey: "BOOKING_DB_URL",
  },
  {
    label: "reviews",
    sourceCollection: "reviews",
    targetEnvKey: "REVIEW_DB_URL",
  },
  {
    label: "notifications",
    sourceCollection: "notifications",
    targetEnvKey: "NOTIFICATION_DB_URL",
    optional: true,
  },
];

const requireEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is required.`);
  }
  return value;
};

const connect = async (url) => {
  const client = new MongoClient(url);
  await client.connect();
  return client;
};

const copyIndexes = async ({ sourceCollection, targetCollection }) => {
  const indexes = await sourceCollection.indexes();
  const secondaryIndexes = indexes.filter((index) => index.name !== "_id_");

  for (const index of secondaryIndexes) {
    const { key, name, v, ns, ...options } = index;
    await targetCollection.createIndex(key, { ...options, name });
  }
};

const copyDocuments = async ({ sourceCollection, targetCollection }) => {
  const cursor = sourceCollection.find({});
  let batch = [];
  let copied = 0;

  for await (const doc of cursor) {
    batch.push({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: true,
      },
    });

    if (batch.length === 500) {
      const result = await targetCollection.bulkWrite(batch, { ordered: false });
      copied += result.upsertedCount + result.modifiedCount + result.matchedCount;
      batch = [];
    }
  }

  if (batch.length > 0) {
    const result = await targetCollection.bulkWrite(batch, { ordered: false });
    copied += result.upsertedCount + result.modifiedCount + result.matchedCount;
  }

  return copied;
};

const migrateCollection = async ({ sourceDb, targetClient, item }) => {
  const sourceCollection = sourceDb.collection(item.sourceCollection);
  const targetDb = targetClient.db();
  const targetCollection = targetDb.collection(item.sourceCollection);

  const sourceCount = await sourceCollection.countDocuments();
  const targetBeforeCount = await targetCollection.countDocuments();

  if (sourceCount === 0 && item.optional) {
    return {
      label: item.label,
      sourceCount,
      targetBeforeCount,
      targetAfterCount: targetBeforeCount,
      skipped: true,
    };
  }

  if (shouldWrite) {
    await copyIndexes({ sourceCollection, targetCollection });
    await copyDocuments({ sourceCollection, targetCollection });
  }

  const targetAfterCount = await targetCollection.countDocuments();

  return {
    label: item.label,
    sourceCount,
    targetBeforeCount,
    targetAfterCount,
    skipped: false,
  };
};

const main = async () => {
  const sourceUrl = requireEnv("MIGRATION_SOURCE_DB_URL");
  const sourceClient = await connect(sourceUrl);
  const sourceDb = sourceClient.db(process.env.MIGRATION_SOURCE_DB_NAME);

  const targetClients = new Map();

  try {
    console.log(`Mode: ${shouldWrite ? "WRITE" : "DRY RUN"}`);
    console.log(`Source database: ${sourceDb.databaseName}`);
    console.log("");

    const results = [];

    for (const item of collections) {
      const targetUrl = requireEnv(item.targetEnvKey);
      const targetClient = await connect(targetUrl);
      targetClients.set(item.targetEnvKey, targetClient);

      const result = await migrateCollection({ sourceDb, targetClient, item });
      results.push({
        ...result,
        targetDatabase: targetClient.db().databaseName,
      });
    }

    for (const result of results) {
      const status = result.skipped ? "skipped optional empty source" : "ready";
      console.log(
        `${result.label}: source=${result.sourceCount}, targetBefore=${result.targetBeforeCount}, targetAfter=${result.targetAfterCount}, targetDb=${result.targetDatabase}, ${status}`
      );
    }

    if (!shouldWrite) {
      console.log("");
      console.log("Dry run only. Re-run with --write to copy documents.");
    }
  } finally {
    await sourceClient.close();
    await Promise.all([...targetClients.values()].map((client) => client.close()));
  }
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
