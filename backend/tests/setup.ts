import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../src/config/db";

let mongoServer: MongoMemoryServer;

// mongodb-memory-server downloads a MongoDB binary (~500MB) to a local cache
// on its very first run, which can take several minutes; every run after
// that reuses the cached binary and starts in a second or two. The generous
// timeout here only matters for that first download.
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
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
