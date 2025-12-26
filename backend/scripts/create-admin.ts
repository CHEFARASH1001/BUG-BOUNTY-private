/**
 * Create Admin User Script
 * 
 * Usage:
 *   npx ts-node scripts/create-admin.ts
 * 
 * Or with custom values:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret123 ADMIN_NAME="Admin User" npx ts-node scripts/create-admin.ts
 * 
 * Environment variables:
 *   MONGODB_URI - MongoDB connection string (defaults to local docker setup)
 *   ADMIN_EMAIL - Admin email (default: admin@bugbounty.local)
 *   ADMIN_PASSWORD - Admin password (default: Admin@123!)
 *   ADMIN_NAME - Admin display name (default: Administrator)
 */

import * as mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';

// Default values
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:bugbounty2024@localhost:27017/bugbounty?authSource=admin';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@bugbounty.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123!';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrator';

// User schema definition (matching src/schemas/user.schema.ts)
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user', 'viewer'], default: 'user' },
  apiKeys: { type: Object, default: {} },
  notifications: {
    type: Object,
    default: {
      email: true,
      slack: false,
      discord: false,
      telegram: false,
      onNewVuln: true,
      onScanComplete: true,
      onNewSubdomain: true,
      minSeverity: 'medium',
    },
  },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  refreshToken: { type: String },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function createAdmin() {
  console.log('🔐 Create Admin User Script');
  console.log('===========================\n');

  try {
    // Connect to MongoDB
    console.log(`📡 Connecting to MongoDB...`);
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check if admin already exists
    const existingUser = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
    
    if (existingUser) {
      console.log(`⚠️  User with email "${ADMIN_EMAIL}" already exists.`);
      
      if (existingUser.role === 'admin') {
        console.log('   This user is already an admin.');
      } else {
        // Upgrade to admin
        existingUser.role = 'admin';
        await existingUser.save();
        console.log('   ✅ User has been upgraded to admin role.');
      }
    } else {
      // Hash password
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

      // Create admin user
      const adminUser = await User.create({
        email: ADMIN_EMAIL.toLowerCase(),
        password: hashedPassword,
        name: ADMIN_NAME,
        role: 'admin',
        isActive: true,
        notifications: {
          email: true,
          slack: false,
          discord: false,
          telegram: false,
          onNewVuln: true,
          onScanComplete: true,
          onNewSubdomain: true,
          minSeverity: 'medium',
        },
      });

      console.log('✅ Admin user created successfully!\n');
      console.log('   📧 Email:', adminUser.email);
      console.log('   👤 Name:', adminUser.name);
      console.log('   🔑 Role:', adminUser.role);
      console.log('   🔒 Password:', ADMIN_PASSWORD);
    }

    console.log('\n🎉 Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

createAdmin();
