// Runs before any application module is imported, so env.ts's validation
// (which happens at import time) always has values to work with. The real
// MongoDB URI is swapped for an in-memory server's URI in tests/setup.ts.
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/talentiq-test-placeholder";
process.env.CORS_ORIGIN = "http://localhost:5173";
// Pinned explicitly (same rationale as CORS_ORIGIN above) so offer-response
// link assertions never depend on whatever a developer's real local .env
// happens to set FRONTEND_URL to.
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.JWT_ACCESS_SECRET = "test-only-access-secret-at-least-32-chars";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN_DAYS = "7";
process.env.BCRYPT_SALT_ROUNDS = "10";
// A fixed, obviously-fake 32-byte key — same "safe fake secret committed
// here, never in .env/.env.example" precedent as JWT_ACCESS_SECRET above.
// Lets tests exercise real AES-256-GCM encrypt/decrypt round-trips (see
// security/googleTokenEncryption.ts) instead of only mocking it away.
process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
