import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { config } from '../config/env.js';

async function bootstrap() {
  await connectDB();

  const email = (process.argv[2] || config.bootstrapAdminEmail || '').trim().toLowerCase();
  const password = process.argv[3] || config.bootstrapAdminPassword || '';

  if (!email || !password) {
    console.error('Usage: node src/scripts/bootstrapAdmin.js <email> <password>');
    console.error('Or set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in backend/.env');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Error: Password must be at least 8 characters long.');
    process.exit(1);
  }

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`User ${email} already exists. Updating role to admin.`);
    existing.role = 'admin';
    await existing.setPassword(password);
    await existing.save();
    console.log(`Admin account ${email} updated successfully.`);
  } else {
    const admin = new User({
      email,
      name: 'Agent Owner',
      role: 'admin',
    });
    await admin.setPassword(password);
    await admin.save();
    console.log(`Admin account ${email} created successfully!`);
  }

  await disconnectDB();
  process.exit(0);
}

bootstrap().catch((err) => {
  console.error('Bootstrap error:', err.message);
  process.exit(1);
});
