const jwt = require('jsonwebtoken');

function decodeJwtPayloadUnsafe(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return payload;
  } catch {
    return null;
  }
}

function normalizeEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  return value || null;
}

function debugClerkToken(token) {
  console.log('=== DEBUGGING CLERK JWT ===\n');
  
  const payload = decodeJwtPayloadUnsafe(token);
  if (!payload) {
    console.log('❌ Failed to decode JWT');
    return;
  }

  console.log('📋 JWT Payload:');
  console.log(JSON.stringify(payload, null, 2));

  console.log('\n🔍 Email Extraction:');
  console.log(`  payload.email: ${payload.email}`);
  console.log(`  payload.email_address: ${payload.email_address}`);
  console.log(`  payload.primary_email_address: ${payload.primary_email_address}`);
  console.log(`  payload.email_addresses: ${JSON.stringify(payload.email_addresses)}`);
  
  const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
  const publicMetadata = payload.public_metadata && typeof payload.public_metadata === 'object' ? payload.public_metadata : {};
  const unsafeMetadata = payload.unsafe_metadata && typeof payload.unsafe_metadata === 'object' ? payload.unsafe_metadata : {};

  console.log(`  metadata.email: ${metadata.email}`);
  console.log(`  public_metadata.email: ${publicMetadata.email}`);
  console.log(`  unsafe_metadata.email: ${unsafeMetadata.email}`);

  const email = normalizeEmail(
    payload.email ||
      payload.email_address ||
      payload.primary_email_address ||
      publicMetadata.email ||
      unsafeMetadata.email ||
      (Array.isArray(payload.email_addresses) ? payload.email_addresses[0]?.email_address : null)
  );

  console.log(`\n✅ Final extracted email: ${email}`);

  console.log('\n👤 Name Extraction:');
  console.log(`  payload.name: ${payload.name}`);
  console.log(`  payload.given_name: ${payload.given_name}`);
  console.log(`  payload.family_name: ${payload.family_name}`);

  const fullName =
    typeof payload.name === 'string' && payload.name.trim()
      ? payload.name.trim()
      : [payload.given_name, payload.family_name].filter(Boolean).join(' ').trim();

  console.log(`\n✅ Final extracted name: ${fullName}`);

  console.log('\n=== END DEBUG ===');
}

// Test with a sample token - you'll need to provide an actual token
console.log('To debug, run: node debug_clerk_jwt.js "YOUR_CLERK_JWT_TOKEN"');
console.log('Get the token from browser localStorage: kpt_token');

if (process.argv[2]) {
  debugClerkToken(process.argv[2]);
}
