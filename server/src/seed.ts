import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { User } from "./models/index.js";
import { hashPassword } from "./services/auth.js";
const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = "Super Admin" } = process.env;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 14 || ADMIN_PASSWORD.length > 256) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (14 to 256 characters)");
await connectDatabase();
try { if (await User.exists({email: ADMIN_EMAIL.toLowerCase()})) throw new Error("Admin already exists"); await User.create({email: ADMIN_EMAIL.toLowerCase(), name: ADMIN_NAME, onboardingStatus:"PENDING", passwordHash: hashPassword(ADMIN_PASSWORD)}); console.log("Administrator created"); } finally { await disconnectDatabase(); }
