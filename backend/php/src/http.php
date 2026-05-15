<?php
declare(strict_types=1);

namespace KptApi;

function json(array $data, int $status = 200): void {
  http_response_code($status);
  echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  exit;
}

function readJsonBody(): array {
  $raw = file_get_contents('php://input');
  if ($raw === false || trim($raw) === '') return [];
  $decoded = json_decode($raw, true);
  return is_array($decoded) ? $decoded : [];
}

function bearerToken(): ?string {
  $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
  if (!$hdr) return null;
  if (stripos($hdr, 'Bearer ') !== 0) return null;
  return trim(substr($hdr, 7));
}

