/**
 * Bootstraps one Company + one ADMIN user for local development, since there
 * is no public registration endpoint (HR/Admin accounts are created by an
 * Admin, which is a future feature). Safe to re-run: skips creation if the
 * admin email already exists.
 *
 * Usage: npm run seed
 */
import { connectDB, disconnectDB } from "../src/config/db";
import { Company } from "../src/models/Company.model";
import { User } from "../src/models/User.model";
import { hashPassword } from "../src/security/password";

const ADMIN_EMAIL = "admin@talentiq.local";
const ADMIN_PASSWORD = "ChangeMe123!";

async function seed(): Promise<void> {
  await connectDB();

  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    console.log(`[seed] Admin user already exists: ${ADMIN_EMAIL}`);
    await disconnectDB();
    return;
  }

  const company = await Company.create({
    name: "Demo Company",
    industry: "Software",
    status: "active",
  });

  const password_hash = await hashPassword(ADMIN_PASSWORD);

  await User.create({
    company_id: company._id,
    name: "Demo Admin",
    email: ADMIN_EMAIL,
    password_hash,
    role: "ADMIN",
    status: "active",
  });

  console.log("[seed] Created company:", company.name);
  console.log("[seed] Created admin user:");
  console.log(`  email:    ${ADMIN_EMAIL}`);
  console.log(`  password: ${ADMIN_PASSWORD}`);

  await disconnectDB();
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
