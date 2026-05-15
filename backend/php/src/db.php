<?php
declare(strict_types=1);

namespace KptApi;

use PDO;

function db(): PDO {
  static $pdo = null;
  if ($pdo instanceof PDO) return $pdo;

  $cfg = config();
  $dsn = sprintf(
    'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
    $cfg['MYSQL_HOST'],
    (int) $cfg['MYSQL_PORT'],
    $cfg['MYSQL_DATABASE']
  );

  $pdo = new PDO($dsn, $cfg['MYSQL_USER'], $cfg['MYSQL_PASSWORD'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
  ]);

  return $pdo;
}

function uuidv4(): string {
  $data = random_bytes(16);
  $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
  $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
  return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

