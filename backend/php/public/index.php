<?php
declare(strict_types=1);

require __DIR__ . '/../src/bootstrap.php';

use function KptApi\json;
use function KptApi\route;

route();

// Fallback (should never reach here)
json(['error' => 'Not found'], 404);

