// Runs before any application module is imported, so env.ts's validation
// (which happens at import time) always has values to work with. The real
// MongoDB URI is swapped for an in-memory server's URI in tests/setup.ts.
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/talentiq-test-placeholder";
process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.JWT_ACCESS_SECRET = "test-only-access-secret-at-least-32-chars";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN_DAYS = "7";
process.env.BCRYPT_SALT_ROUNDS = "10";
