<?php
declare(strict_types=1);

namespace KptApi;

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/jwt.php';
require_once __DIR__ . '/routes.php';

// Basic headers
header('Content-Type: application/json; charset=utf-8');

$cfg = config();

// CORS (Hostinger shared hosting friendly)
if (!empty($cfg['API_CORS_ORIGIN'])) {
  header('Access-Control-Allow-Origin: ' . $cfg['API_CORS_ORIGIN']);
  header('Vary: Origin');
}
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

