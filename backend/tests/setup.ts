import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../src/config/db";

let mongoServer: MongoMemoryReplSet;

// A single-node replica set, not a standalone instance — multi-document
// transactions (used by stageTransition.service.ts's moveApplicationStage,
// see its doc comment) require a replica set; a standalone mongod cannot
// run them at all. This codebase's production target (MongoDB Atlas) is
// always already a replica set, so this was purely a test-infrastructure
// gap, not a production feasibility question — verified working (a real
// transaction commits successfully) before switching every test file over
// to it. A single-node replica set starts in roughly the same time as a
// standalone instance did.
//
// mongodb-memory-server downloads a MongoDB binary (~500MB) to a local cache
// on its very first run, which can take several minutes; every run after
// that reuses the cached binary and starts in a second or two. The generous
// timeout here only matters for that first download.
beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDB(mongoServer.getUri());
}, 600000);

afterEach(async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await disconnectDB();
  await mongoServer.stop();
});
