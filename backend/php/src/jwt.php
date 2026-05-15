<?php
declare(strict_types=1);

namespace KptApi;

// ---- Legacy HS256 JWT helpers (kept for backward compat) ----

function b64urlEncode(string $data): string {
  return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function b64urlDecode(string $data): string {
  $padLen = 4 - (strlen($data) % 4);
  if ($padLen < 4) $data .= str_repeat('=', $padLen);
  return base64_decode(strtr($data, '-_', '+/')) ?: '';
}

function jwtSign(array $payload, string $secret): string {
  $header = ['alg' => 'HS256', 'typ' => 'JWT'];
  $h = b64urlEncode(json_encode($header));
  $p = b64urlEncode(json_encode($payload));
  $sig = hash_hmac('sha256', $h . '.' . $p, $secret, true);
  return $h . '.' . $p . '.' . b64urlEncode($sig);
}

function jwtVerify(string $token, string $secret): ?array {
  $parts = explode('.', $token);
  if (count($parts) !== 3) return null;
  [$h, $p, $s] = $parts;
  $sig = b64urlDecode($s);
  $expected = hash_hmac('sha256', $h . '.' . $p, $secret, true);
  if (!hash_equals($expected, $sig)) return null;
  $payload = json_decode(b64urlDecode($p), true);
  if (!is_array($payload)) return null;
  if (isset($payload['exp']) && is_numeric($payload['exp']) && time() > (int) $payload['exp']) return null;
  return $payload;
}

// ---- Clerk JWT verification ----

function decodeClerkJwtPayload(string $jwt): ?array {
  $parts = explode('.', $jwt);
  if (count($parts) !== 3) return null;

  $payload = base64_decode(strtr($parts[1], '-_', '+/'));
  if (!$payload) return null;

  $data = json_decode($payload, true);
  return is_array($data) ? $data : null;
}

/**
 * Verify a Clerk-issued JWT and return the user ID (sub claim).
 *
 * Strategy 1: If CLERK_SECRET_KEY is set, verify via Clerk Backend API.
 * Strategy 2 (fallback): Decode payload without sig check (dev only).
 */
function verifyClerkToken(string $token): ?string {
  $cfg = config();
  $clerkSecret = $cfg['CLERK_SECRET_KEY'] ?? '';

  if (!empty($clerkSecret)) {
    $ch = curl_init("https://api.clerk.com/v1/tokens/verify");
    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_POST => true,
      CURLOPT_HTTPHEADER => [
        "Authorization: Bearer {$clerkSecret}",
        "Content-Type: application/json",
      ],
      CURLOPT_POSTFIELDS => json_encode(['token' => $token]),
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $response) {
      $data = json_decode($response, true);
      return $data['sub'] ?? null;
    }
    return null;
  }

  // Fallback: decode without verification (DEV ONLY)
  $payload = decodeClerkJwtPayload($token);
  if (!$payload) return null;
  if (isset($payload['exp']) && $payload['exp'] < time()) return null;
  return $payload['sub'] ?? null;
}

/**
 * Extract Bearer token from Authorization header and verify with Clerk.
 * Returns Clerk user_id or null.
 */
function authenticateRequest(): ?string {
  $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
  if (!preg_match('/^Bearer\s+(.+)$/i', $header, $m)) return null;
  return verifyClerkToken(trim($m[1]));
}
