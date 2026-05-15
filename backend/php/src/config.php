<?php
declare(strict_types=1);

namespace KptApi;

/**
 * Loads server-side configuration.
 */
function config(): array {
  static $cached = null;
  if (is_array($cached)) return $cached;

  $localPath = __DIR__ . '/config.local.php';
  $local = [];
  if (file_exists($localPath)) {
    $loaded = require $localPath;
    if (is_array($loaded)) $local = $loaded;
  }

  $get = static function (string $key, $default = null) use ($local) {
    $env = getenv($key);
    if ($env !== false && $env !== '') return $env;
    return $local[$key] ?? $default;
  };

  $cfg = [
    'MYSQL_HOST' => (string) $get('MYSQL_HOST', 'localhost'),
    'MYSQL_PORT' => (int) $get('MYSQL_PORT', 3306),
    'MYSQL_USER' => (string) $get('MYSQL_USER', ''),
    'MYSQL_PASSWORD' => (string) $get('MYSQL_PASSWORD', ''),
    'MYSQL_DATABASE' => (string) $get('MYSQL_DATABASE', ''),
    'API_CORS_ORIGIN' => (string) $get('API_CORS_ORIGIN', ''),
    'JWT_SECRET' => (string) $get('JWT_SECRET', ''),
    'CLERK_SECRET_KEY' => (string) $get('CLERK_SECRET_KEY', ''),
  ];

  $cached = $cfg;
  return $cfg;
}
