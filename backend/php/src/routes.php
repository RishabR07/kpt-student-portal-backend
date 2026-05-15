<?php
declare(strict_types=1);

namespace KptApi;

use PDO;

function route(): void {
  $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
  $uri = $_SERVER['REQUEST_URI'] ?? '/';
  $path = parse_url($uri, PHP_URL_PATH) ?: '/';

  // Hostinger often deploys under a subfolder; strip it by finding "/api/"
  $apiPos = strpos($path, '/api/');
  if ($apiPos === false) {
    if ($path === '/' || $path === '') {
      json(['ok' => true, 'service' => 'kpt-api'], 200);
    }
    json(['error' => 'Not found'], 404);
  }

  $path = substr($path, $apiPos);

  if ($method === 'GET' && $path === '/api/health') {
    json(['ok' => true], 200);
  }

  if ($method === 'POST' && $path === '/api/auth/login') {
    authLogin();
  }

  if ($method === 'POST' && $path === '/api/auth/signup') {
    authSignup();
  }

  if ($method === 'GET' && $path === '/api/auth/me') {
    $auth = requireAuth();
    json(['user' => $auth['user']], 200);
  }

  if ($method === 'POST' && $path === '/api/auth/change-password') {
    $auth = requireAuth();
    authChangePassword($auth['user']['id']);
  }

  if ($method === 'GET' && $path === '/api/student/dashboard') {
    $auth = requireAuth('student');
    studentDashboard($auth['user']['id']);
  }

  if ($method === 'GET' && $path === '/api/student/marks') {
    $auth = requireAuth('student');
    studentMarks($auth['user']['id']);
  }

  if ($method === 'GET' && $path === '/api/student/attendance') {
    $auth = requireAuth('student');
    studentAttendance($auth['user']['id']);
  }

  if ($method === 'GET' && $path === '/api/teacher/subjects') {
    $auth = requireAuth('teacher');
    teacherSubjects($auth['user']['id']);
  }

  if ($method === 'POST' && $path === '/api/teacher/subjects') {
    $auth = requireAuth('teacher');
    teacherCreateSubject($auth['user']['id']);
  }

  if ($method === 'DELETE' && preg_match('~^/api/teacher/subjects/([^/]+)$~', $path, $m)) {
    $auth = requireAuth('teacher');
    teacherDeleteSubject($m[1], $auth['user']['id']);
  }

  if ($method === 'GET' && preg_match('~^/api/teacher/subjects/([^/]+)/students$~', $path, $m)) {
    $auth = requireAuth('teacher');
    teacherSubjectStudents($m[1], $auth['user']['id']);
  }

  if ($method === 'POST' && preg_match('~^/api/teacher/subjects/([^/]+)/bulk-enroll$~', $path, $m)) {
    $auth = requireAuth('teacher');
    teacherBulkEnroll($m[1], $auth['user']['id']);
  }

  if ($method === 'GET' && $path === '/api/teacher/me') {
    $auth = requireAuth('teacher');
    teacherMe($auth['user']['id']);
  }

  if ($method === 'GET' && $path === '/api/teacher/dashboard') {
    $auth = requireAuth('teacher');
    teacherDashboard($auth['user']['id']);
  }

  json(['error' => 'Not found'], 404);
}

function requireAuth(?string $requiredRole = null): array {
  // Try Clerk JWT first, then fall back to legacy HS256 JWT
  $clerkUserId = authenticateRequest();

  if ($clerkUserId) {
    // Clerk-authenticated: look up user in MySQL by clerk_user_id or id
    $pdo = db();
    $stmt = $pdo->prepare('SELECT p.id, p.name, p.email, p.department, ur.role
                           FROM profiles p
                           LEFT JOIN user_roles ur ON ur.user_id = p.id
                           WHERE p.id = ? LIMIT 1');
    $stmt->execute([$clerkUserId]);
    $row = $stmt->fetch();

    if (!$row) {
      // Auto-create profile stub for new Clerk users
      json(['error' => 'User profile not found. Ask admin to create your profile.'], 404);
    }

    $user = [
      'id' => (string) ($row['id'] ?? $clerkUserId),
      'email' => (string) ($row['email'] ?? ''),
      'name' => (string) ($row['name'] ?? ''),
      'role' => (string) ($row['role'] ?? 'student'),
      'department' => $row['department'] ?? null,
    ];

    if ($requiredRole && $user['role'] !== $requiredRole) json(['error' => 'Forbidden'], 403);
    return ['user' => $user, 'payload' => []];
  }

  // Legacy HS256 JWT fallback
  $cfg = config();
  if (empty($cfg['JWT_SECRET'])) json(['error' => 'Server misconfigured'], 500);

  $token = bearerToken();
  if (!$token) json(['error' => 'Unauthorized'], 401);

  $payload = jwtVerify($token, $cfg['JWT_SECRET']);
  if (!$payload) json(['error' => 'Unauthorized'], 401);

  $user = [
    'id' => (string) ($payload['sub'] ?? ''),
    'email' => (string) ($payload['email'] ?? ''),
    'name' => (string) ($payload['name'] ?? ''),
    'role' => (string) ($payload['role'] ?? 'student'),
    'department' => $payload['department'] ?? null,
  ];

  if (!$user['id']) json(['error' => 'Unauthorized'], 401);
  if ($requiredRole && $user['role'] !== $requiredRole) json(['error' => 'Forbidden'], 403);

  return ['user' => $user, 'payload' => $payload];
}

function teacherSubjects(string $teacherUserId): void {
  $pdo = db();

  $teacherStmt = $pdo->prepare('SELECT id FROM teachers WHERE user_id = ? LIMIT 1');
  $teacherStmt->execute([$teacherUserId]);
  $teacher = $teacherStmt->fetch();
  if (!$teacher) json(['error' => 'Teacher not found'], 404);

  $stmt = $pdo->prepare(
    "SELECT s.*,
            (SELECT COUNT(*) FROM enrollments e WHERE e.subject_id = s.id AND e.status = 'enrolled') AS enrolledStudents
     FROM subjects s
     WHERE s.teacher_id = ?
     ORDER BY s.created_at DESC"
  );
  $stmt->execute([(string) $teacher['id']]);

  $subjects = [];
  foreach (($stmt->fetchAll() ?: []) as $row) {
    $subjects[] = [
      'id' => (string) $row['id'],
      'code' => (string) $row['code'],
      'name' => (string) $row['name'],
      'description' => $row['description'],
      'credits' => (int) ($row['credits'] ?? 0),
      'semester' => (int) ($row['semester'] ?? 0),
      'max_students' => (int) ($row['max_students'] ?? 60),
      'enrolledStudents' => (int) ($row['enrolledStudents'] ?? 0),
      'created_at' => $row['created_at'] ?? null,
    ];
  }

  json(['subjects' => $subjects], 200);
}

function teacherCreateSubject(string $teacherUserId): void {
  $input = readJsonBody();

  $code = trim((string) ($input['code'] ?? ''));
  $name = trim((string) ($input['name'] ?? ''));
  $description = isset($input['description']) ? (string) $input['description'] : null;
  $credits = (int) ($input['credits'] ?? 3);
  $semester = (int) ($input['semester'] ?? 1);
  $maxStudents = (int) ($input['max_students'] ?? 60);

  if ($code === '' || $name === '') json(['error' => 'Subject code and name are required'], 400);

  $pdo = db();
  $teacherStmt = $pdo->prepare('SELECT id FROM teachers WHERE user_id = ? LIMIT 1');
  $teacherStmt->execute([$teacherUserId]);
  $teacher = $teacherStmt->fetch();
  if (!$teacher) json(['error' => 'Teacher not found'], 404);

  $subjectId = uuidv4();

  try {
    $stmt = $pdo->prepare(
      "INSERT INTO subjects (id, code, name, description, credits, semester, teacher_id, max_students, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())"
    );

    $stmt->execute([
      $subjectId,
      $code,
      $name,
      $description,
      $credits,
      $semester,
      (string) $teacher['id'],
      $maxStudents,
    ]);

    json(['message' => 'Subject created successfully', 'data' => ['id' => $subjectId]], 201);
  } catch (\PDOException $e) {
    if ((string) $e->getCode() === '23000') json(['error' => 'Subject code already exists'], 409);
    json(['error' => 'Failed to create subject'], 500);
  }
}

function teacherDeleteSubject(string $subjectId, string $teacherUserId): void {
  $pdo = db();

  $stmt = $pdo->prepare(
    'SELECT s.id
     FROM subjects s
     JOIN teachers t ON s.teacher_id = t.id
     WHERE s.id = ? AND t.user_id = ?
     LIMIT 1'
  );
  $stmt->execute([$subjectId, $teacherUserId]);
  if (!$stmt->fetch()) json(['error' => 'Subject not found or access denied'], 404);

  try {
    $del = $pdo->prepare('DELETE FROM subjects WHERE id = ?');
    $del->execute([$subjectId]);
    json(['message' => 'Subject deleted successfully'], 200);
  } catch (\PDOException $e) {
    json(['error' => 'Failed to delete subject'], 500);
  }
}

function teacherMe(string $teacherUserId): void {
  $pdo = db();
  $stmt = $pdo->prepare('SELECT id, name, email, department FROM profiles WHERE id = ? LIMIT 1');
  $stmt->execute([$teacherUserId]);
  $profile = $stmt->fetch();
  if (!$profile) json(['error' => 'Profile not found'], 404);

  $t = $pdo->prepare('SELECT id FROM teachers WHERE user_id = ? LIMIT 1');
  $t->execute([$teacherUserId]);
  $teacher = $t->fetch();

  json([
    'profile' => $profile,
    'teacher' => $teacher ? ['id' => (string) ($teacher['id'] ?? '')] : null,
  ], 200);
}

function teacherSubjectStudents(string $subjectId, string $teacherUserId): void {
  $pdo = db();

  $teacherStmt = $pdo->prepare('SELECT id FROM teachers WHERE user_id = ? LIMIT 1');
  $teacherStmt->execute([$teacherUserId]);
  $teacher = $teacherStmt->fetch();
  if (!$teacher) json(['error' => 'Teacher not found'], 404);
  $teacherId = (string) $teacher['id'];

  $subjectStmt = $pdo->prepare('SELECT id FROM subjects WHERE id = ? AND teacher_id = ? LIMIT 1');
  $subjectStmt->execute([$subjectId, $teacherId]);
  if (!$subjectStmt->fetch()) json(['error' => 'Subject not found or access denied'], 404);

  $stmt = $pdo->prepare(
    "SELECT
        st.id AS studentId,
        st.user_id AS userId,
        st.roll_number AS rollNumber,
        p.name AS name,
        p.email AS email
     FROM enrollments e
     JOIN students st ON st.id = e.student_id
     JOIN profiles p ON p.id = st.user_id
     WHERE e.subject_id = ? AND e.status = 'enrolled'
     ORDER BY st.roll_number ASC, p.name ASC"
  );
  $stmt->execute([$subjectId]);

  $students = [];
  foreach (($stmt->fetchAll() ?: []) as $row) {
    $students[] = [
      'studentId' => (string) ($row['studentId'] ?? ''),
      'userId' => (string) ($row['userId'] ?? ''),
      'rollNumber' => (string) ($row['rollNumber'] ?? ''),
      'name' => (string) ($row['name'] ?? ''),
      'email' => (string) ($row['email'] ?? ''),
    ];
  }

  json(['students' => $students], 200);
}

function teacherBulkEnroll(string $subjectId, string $teacherUserId): void {
  $pdo = db();
  $input = readJsonBody();
  $enrollments = $input['enrollments'] ?? null;
  if (!is_array($enrollments) || count($enrollments) === 0) json(['error' => 'enrollments is required'], 400);

  $teacherStmt = $pdo->prepare('SELECT id FROM teachers WHERE user_id = ? LIMIT 1');
  $teacherStmt->execute([$teacherUserId]);
  $teacher = $teacherStmt->fetch();
  if (!$teacher) json(['error' => 'Teacher not found'], 404);
  $teacherId = (string) $teacher['id'];

  $subjectStmt = $pdo->prepare('SELECT id, code FROM subjects WHERE id = ? AND teacher_id = ? LIMIT 1');
  $subjectStmt->execute([$subjectId, $teacherId]);
  $subject = $subjectStmt->fetch();
  if (!$subject) json(['error' => 'Subject not found or access denied'], 404);
  $subjectCode = (string) ($subject['code'] ?? '');

  $result = [
    'success' => 0,
    'failed' => 0,
    'errors' => [],
  ];

  $nowYear = (int) date('Y');
  $normalizeEmail = static fn($v): string => strtolower(trim((string) $v));
  $isValidEmail = static fn(string $email): bool => (bool) preg_match('/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/', $email);
  $defaultNameFromEmail = static function (string $email): string {
    $local = explode('@', $email)[0] ?? 'student';
    $local = preg_replace('/[._-]+/', ' ', $local);
    $local = trim((string) $local);
    $local = preg_replace_callback('/\\b\\w/', fn($m) => strtoupper($m[0]), $local);
    return $local !== '' ? $local : 'Student';
  };
  $generateRollNumber = static function (): string {
    $base = substr((string) round(microtime(true) * 1000), -6);
    $rand = strtoupper(substr(bin2hex(random_bytes(4)), 0, 4));
    return "AUTO{$base}{$rand}";
  };

  for ($i = 0; $i < count($enrollments); $i++) {
    $rowNum = $i + 2; // header + 1-based
    $e = is_array($enrollments[$i] ?? null) ? $enrollments[$i] : [];

    $email = $normalizeEmail($e['studentEmail'] ?? ($e['email'] ?? ''));
    $status = strtolower(trim((string) ($e['status'] ?? 'enrolled')));
    $enrollmentDate = isset($e['enrollmentDate']) ? trim((string) $e['enrollmentDate']) : '';
    $enrollmentDate = $enrollmentDate !== '' ? $enrollmentDate : null;

    if ($email === '' || !$isValidEmail($email)) {
      $result['failed']++;
      $result['errors'][] = [
        'row' => $rowNum,
        'email' => (string) ($e['studentEmail'] ?? ''),
        'subject' => (string) ($e['subjectCode'] ?? $subjectCode),
        'error' => "Invalid email: " . (string) ($e['studentEmail'] ?? ''),
      ];
      continue;
    }

    if (!in_array($status, ['enrolled', 'dropped', 'completed'], true)) {
      $result['failed']++;
      $result['errors'][] = [
        'row' => $rowNum,
        'email' => $email,
        'subject' => (string) ($e['subjectCode'] ?? $subjectCode),
        'error' => "Invalid status: {$status}",
      ];
      continue;
    }

    try {
      // Find or create user by email
      $userStmt = $pdo->prepare('SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1');
      $userStmt->execute([$email]);
      $user = $userStmt->fetch();

      $userId = $user ? (string) $user['id'] : uuidv4();
      if (!$user) {
        $pwd = 'generated-' . bin2hex(random_bytes(8));
        $ins = $pdo->prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)');
        $ins->execute([$userId, $email, $pwd]);
      }

      // Ensure profile
      $pStmt = $pdo->prepare('SELECT id FROM profiles WHERE id = ? LIMIT 1');
      $pStmt->execute([$userId]);
      $profile = $pStmt->fetch();
      if (!$profile) {
        $name = trim((string) ($e['name'] ?? ''));
        if ($name === '') $name = $defaultNameFromEmail($email);
        $dept = trim((string) ($e['department'] ?? 'General'));
        $insP = $pdo->prepare('INSERT INTO profiles (id, name, email, department) VALUES (?, ?, ?, ?)');
        $insP->execute([$userId, $name, $email, $dept !== '' ? $dept : 'General']);
      }

      // Ensure student role
      $rStmt = $pdo->prepare('SELECT role FROM user_roles WHERE user_id = ? LIMIT 1');
      $rStmt->execute([$userId]);
      $roleRow = $rStmt->fetch();
      if (!$roleRow) {
        $insR = $pdo->prepare('INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)');
        $insR->execute([uuidv4(), $userId, 'student']);
      } elseif ((string) ($roleRow['role'] ?? '') !== 'student') {
        $result['failed']++;
        $result['errors'][] = [
          'row' => $rowNum,
          'email' => $email,
          'subject' => (string) ($e['subjectCode'] ?? $subjectCode),
          'error' => "User role is '" . (string) $roleRow['role'] . "', not 'student'",
        ];
        continue;
      }

      // Ensure student record
      $sStmt = $pdo->prepare('SELECT id FROM students WHERE user_id = ? LIMIT 1');
      $sStmt->execute([$userId]);
      $student = $sStmt->fetch();
      $studentId = $student ? (string) $student['id'] : uuidv4();
      if (!$student) {
        $roll = trim((string) ($e['rollNumber'] ?? ''));
        if ($roll === '') $roll = $generateRollNumber();
        $semester = (int) ($e['semester'] ?? 1);
        if ($semester < 1) $semester = 1;

        try {
          $insS = $pdo->prepare(
            'INSERT INTO students (id, user_id, roll_number, semester, enrollment_year, status) VALUES (?, ?, ?, ?, ?, ?)'
          );
          $insS->execute([$studentId, $userId, $roll, $semester, $nowYear, 'active']);
        } catch (\PDOException $ex) {
          if ((string) $ex->getCode() === '23000') {
            $roll2 = $generateRollNumber();
            $insS = $pdo->prepare(
              'INSERT INTO students (id, user_id, roll_number, semester, enrollment_year, status) VALUES (?, ?, ?, ?, ?, ?)'
            );
            $insS->execute([$studentId, $userId, $roll2, $semester, $nowYear, 'active']);
          } else {
            throw $ex;
          }
        }
      }

      // Insert enrollment
      $enrollId = uuidv4();
      if ($enrollmentDate) {
        $insE = $pdo->prepare('INSERT INTO enrollments (id, student_id, subject_id, enrollment_date, status) VALUES (?, ?, ?, ?, ?)');
        $insE->execute([$enrollId, $studentId, $subjectId, $enrollmentDate, $status]);
      } else {
        $insE = $pdo->prepare('INSERT INTO enrollments (id, student_id, subject_id, status) VALUES (?, ?, ?, ?)');
        $insE->execute([$enrollId, $studentId, $subjectId, $status]);
      }

      $result['success']++;
    } catch (\PDOException $ex) {
      if ((string) $ex->getCode() === '23000') {
        $result['failed']++;
        $result['errors'][] = [
          'row' => $rowNum,
          'email' => $email,
          'subject' => (string) ($e['subjectCode'] ?? $subjectCode),
          'error' => 'Student already enrolled in this subject',
        ];
        continue;
      }

      $result['failed']++;
      $result['errors'][] = [
        'row' => $rowNum,
        'email' => $email,
        'subject' => (string) ($e['subjectCode'] ?? $subjectCode),
        'error' => $ex->getMessage(),
      ];
    } catch (\Throwable $ex) {
      $result['failed']++;
      $result['errors'][] = [
        'row' => $rowNum,
        'email' => $email,
        'subject' => (string) ($e['subjectCode'] ?? $subjectCode),
        'error' => $ex->getMessage(),
      ];
    }
  }

  json($result, 200);
}

function teacherDashboard(string $teacherUserId): void {
  $pdo = db();

  $teacherStmt = $pdo->prepare('SELECT id FROM teachers WHERE user_id = ? LIMIT 1');
  $teacherStmt->execute([$teacherUserId]);
  $teacher = $teacherStmt->fetch();
  if (!$teacher) json(['error' => 'Teacher not found'], 404);
  $teacherId = (string) $teacher['id'];

  $subStmt = $pdo->prepare(
    "SELECT s.id, s.code, s.name, s.semester, s.credits,
            (SELECT COUNT(*) FROM enrollments e WHERE e.subject_id = s.id AND e.status = 'enrolled') AS enrolledStudents
     FROM subjects s
     WHERE s.teacher_id = ?
     ORDER BY s.created_at DESC"
  );
  $subStmt->execute([$teacherId]);
  $subjects = $subStmt->fetchAll() ?: [];

  $totalStudents = 0;
  foreach ($subjects as $s) {
    $totalStudents += (int) ($s['enrolledStudents'] ?? 0);
  }

  $annStmt = $pdo->prepare(
    "SELECT id, title, content, published_at
     FROM announcements
     WHERE (target_role = 'teacher' OR target_role = 'all' OR target_role IS NULL)
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY published_at DESC
     LIMIT 5"
  );
  $annStmt->execute();
  $annRows = $annStmt->fetchAll() ?: [];

  $announcements = [];
  foreach ($annRows as $a) {
    $announcements[] = [
      'id' => (string) $a['id'],
      'title' => (string) $a['title'],
      'content' => (string) $a['content'],
      'created_at' => (string) $a['published_at'],
    ];
  }

  json([
    'data' => [
      'subjects' => array_map(static function (array $s) {
        return [
          'id' => (string) $s['id'],
          'code' => (string) $s['code'],
          'name' => (string) $s['name'],
          'semester' => (int) ($s['semester'] ?? 0),
          'credits' => (int) ($s['credits'] ?? 0),
          'enrolledStudents' => (int) ($s['enrolledStudents'] ?? 0),
        ];
      }, $subjects),
      'totalStudents' => $totalStudents,
      'totalSubjects' => (int) count($subjects),
      'announcements' => $announcements,
    ],
  ], 200);
}

function authLogin(): void {
  $body = readJsonBody();
  $email = strtolower(trim((string) ($body['email'] ?? '')));
  $password = (string) ($body['password'] ?? '');
  if (!$email || !$password) json(['error' => 'Email and password required'], 400);

  $pdo = db();
  $stmt = $pdo->prepare('SELECT id, email, password_hash FROM users WHERE email = ? LIMIT 1');
  $stmt->execute([$email]);
  $row = $stmt->fetch();
  if (!$row || !password_verify($password, (string) $row['password_hash'])) {
    json(['error' => 'Invalid credentials'], 401);
  }

  $userId = (string) $row['id'];

  $profileStmt = $pdo->prepare('SELECT name, department, email FROM profiles WHERE id = ? LIMIT 1');
  $profileStmt->execute([$userId]);
  $profile = $profileStmt->fetch() ?: [];

  $roleStmt = $pdo->prepare('SELECT role FROM user_roles WHERE user_id = ? LIMIT 1');
  $roleStmt->execute([$userId]);
  $roleRow = $roleStmt->fetch() ?: [];

  $cfg = config();
  $user = [
    'id' => $userId,
    'name' => (string) ($profile['name'] ?? ''),
    'email' => (string) ($profile['email'] ?? $email),
    'role' => (string) ($roleRow['role'] ?? 'student'),
    'department' => $profile['department'] ?? null,
  ];

  $token = jwtSign([
    'sub' => $user['id'],
    'email' => $user['email'],
    'name' => $user['name'],
    'role' => $user['role'],
    'department' => $user['department'],
    'iat' => time(),
    'exp' => time() + 60 * 60 * 24 * 7, // 7 days
  ], $cfg['JWT_SECRET']);

  json(['token' => $token, 'user' => $user], 200);
}

function authSignup(): void {
  $body = readJsonBody();
  $email = strtolower(trim((string) ($body['email'] ?? '')));
  $password = (string) ($body['password'] ?? '');
  $name = trim((string) ($body['name'] ?? ''));
  $role = (string) ($body['role'] ?? 'student');
  $department = isset($body['department']) ? (string) $body['department'] : null;

  if (!$email || !$password || !$name) json(['error' => 'Name, email, and password required'], 400);
  if (!in_array($role, ['admin', 'teacher', 'student'], true)) json(['error' => 'Invalid role'], 400);
  if (strlen($password) < 6) json(['error' => 'Password too short'], 400);

  $pdo = db();
  $userId = uuidv4();
  $hash = password_hash($password, PASSWORD_BCRYPT);

  try {
    $pdo->beginTransaction();

    $u = $pdo->prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)');
    $u->execute([$userId, $email, $hash]);

    $p = $pdo->prepare('INSERT INTO profiles (id, name, email, department) VALUES (?, ?, ?, ?)');
    $p->execute([$userId, $name, $email, $department]);

    $r = $pdo->prepare('INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)');
    $r->execute([uuidv4(), $userId, $role]);

    // Minimal compatibility: create a student/teacher row so portal queries work.
    if ($role === 'student') {
      $roll = explode('@', $email)[0];
      $s = $pdo->prepare('INSERT INTO students (id, user_id, roll_number, status) VALUES (?, ?, ?, ?)');
      $s->execute([uuidv4(), $userId, $roll, 'active']);
    } elseif ($role === 'teacher') {
      $emp = explode('@', $email)[0];
      $t = $pdo->prepare('INSERT INTO teachers (id, user_id, employee_id, status) VALUES (?, ?, ?, ?)');
      $t->execute([uuidv4(), $userId, $emp, 'active']);
    }

    $pdo->commit();
  } catch (\Throwable $e) {
    $pdo->rollBack();
    json(['error' => 'Signup failed'], 400);
  }

  $cfg = config();
  $user = [
    'id' => $userId,
    'name' => $name,
    'email' => $email,
    'role' => $role,
    'department' => $department,
  ];

  $token = jwtSign([
    'sub' => $user['id'],
    'email' => $user['email'],
    'name' => $user['name'],
    'role' => $user['role'],
    'department' => $user['department'],
    'iat' => time(),
    'exp' => time() + 60 * 60 * 24 * 7,
  ], $cfg['JWT_SECRET']);

  json(['token' => $token, 'user' => $user], 200);
}

function authChangePassword(string $userId): void {
  $body = readJsonBody();
  $newPassword = (string) ($body['newPassword'] ?? '');
  if (!$newPassword || strlen($newPassword) < 6) json(['error' => 'Password must be at least 6 characters'], 400);

  $pdo = db();
  $hash = password_hash($newPassword, PASSWORD_BCRYPT);
  $stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
  $stmt->execute([$hash, $userId]);

  json(['success' => true], 200);
}

function studentIdForUser(PDO $pdo, string $userId): ?string {
  $stmt = $pdo->prepare('SELECT id FROM students WHERE user_id = ? LIMIT 1');
  $stmt->execute([$userId]);
  $row = $stmt->fetch();
  return $row ? (string) $row['id'] : null;
}

function studentDashboard(string $userId): void {
  $pdo = db();
  $studentId = studentIdForUser($pdo, $userId);
  if (!$studentId) json(['error' => 'Student record not found'], 404);

  // Attendance rate
  $attStmt = $pdo->prepare('SELECT status FROM attendance WHERE student_id = ?');
  $attStmt->execute([$studentId]);
  $attRows = $attStmt->fetchAll();
  $attendanceRate = 0;
  if ($attRows && count($attRows) > 0) {
    $present = 0;
    foreach ($attRows as $r) if (($r['status'] ?? '') === 'present') $present++;
    $attendanceRate = (int) round(($present / count($attRows)) * 100);
  }

  // Marks averages and recent marks
  $marksStmt = $pdo->prepare(
    'SELECT m.id, m.exam_type, m.total_marks, m.marks_obtained, m.created_at, s.name AS subject_name
     FROM marks m
     JOIN subjects s ON s.id = m.subject_id
     WHERE m.student_id = ?
     ORDER BY m.created_at DESC
     LIMIT 10'
  );
  $marksStmt->execute([$studentId]);
  $marksRows = $marksStmt->fetchAll();

  $averageMarks = 0;
  $recentMarks = [];
  if ($marksRows && count($marksRows) > 0) {
    $sumPct = 0.0;
    $count = 0;
    foreach ($marksRows as $m) {
      $max = (float) ($m['total_marks'] ?? 0);
      $obt = (float) ($m['marks_obtained'] ?? 0);
      $pct = $max > 0 ? ($obt / $max) * 100 : 0;
      $sumPct += $pct;
      $count++;
    }
    $averageMarks = (int) round($sumPct / max(1, $count));

    foreach (array_slice($marksRows, 0, 4) as $m) {
      $max = (float) ($m['total_marks'] ?? 0);
      $obt = (float) ($m['marks_obtained'] ?? 0);
      $pct = $max > 0 ? ($obt / $max) * 100 : 0;
      $recentMarks[] = [
        'id' => (string) $m['id'],
        'subjectName' => (string) $m['subject_name'],
        'assessmentType' => (string) $m['exam_type'],
        'maxMarks' => (float) $m['total_marks'],
        'obtainedMarks' => (float) $m['marks_obtained'],
        'percentage' => (int) round($pct),
      ];
    }
  }

  // Subjects count
  $subStmt = $pdo->prepare("SELECT COUNT(*) AS c FROM enrollments WHERE student_id = ? AND status = 'enrolled'");
  $subStmt->execute([$studentId]);
  $subjectsCount = (int) (($subStmt->fetch()['c'] ?? 0));

  // Announcements
  $annStmt = $pdo->prepare(
    "SELECT id, title, content, published_at
     FROM announcements
     WHERE (target_role = 'student' OR target_role = 'all' OR target_role IS NULL)
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY published_at DESC
     LIMIT 5"
  );
  $annStmt->execute();
  $annRows = $annStmt->fetchAll();

  $latestAnnouncements = [];
  foreach (array_slice($annRows ?: [], 0, 3) as $a) {
    $latestAnnouncements[] = [
      'id' => (string) $a['id'],
      'title' => (string) $a['title'],
      'content' => (string) $a['content'],
      'createdAt' => (string) $a['published_at'],
    ];
  }

  json([
    'attendanceRate' => $attendanceRate,
    'averageMarks' => $averageMarks,
    'subjectsCount' => $subjectsCount,
    'announcementsCount' => (int) count($annRows ?: []),
    'recentMarks' => $recentMarks,
    'latestAnnouncements' => $latestAnnouncements,
  ], 200);
}

function studentMarks(string $userId): void {
  $pdo = db();
  $studentId = studentIdForUser($pdo, $userId);
  if (!$studentId) json(['error' => 'Student record not found'], 404);

  $stmt = $pdo->prepare(
    'SELECT m.id, s.name AS subjectName, m.exam_type AS assessmentType,
            m.total_marks AS maxMarks, m.marks_obtained AS obtainedMarks
     FROM marks m
     JOIN subjects s ON s.id = m.subject_id
     WHERE m.student_id = ?
     ORDER BY s.name ASC, m.exam_type ASC'
  );
  $stmt->execute([$studentId]);
  $rows = $stmt->fetchAll();

  $result = [];
  foreach ($rows ?: [] as $r) {
    $max = (float) ($r['maxMarks'] ?? 0);
    $obt = (float) ($r['obtainedMarks'] ?? 0);
    $pct = $max > 0 ? (int) round(($obt / $max) * 100) : 0;
    $result[] = [
      'id' => (string) $r['id'],
      'subjectName' => (string) $r['subjectName'],
      'assessmentType' => (string) $r['assessmentType'],
      'maxMarks' => $max,
      'obtainedMarks' => $obt,
      'percentage' => $pct,
    ];
  }

  json(['marks' => $result], 200);
}

function studentAttendance(string $userId): void {
  $pdo = db();
  $studentId = studentIdForUser($pdo, $userId);
  if (!$studentId) json(['error' => 'Student record not found'], 404);

  $stmt = $pdo->prepare(
    'SELECT a.id, a.attendance_date AS date, a.status,
            s.id AS subjectId, s.name AS subjectName, s.code AS subjectCode
     FROM attendance a
     JOIN subjects s ON s.id = a.subject_id
     WHERE a.student_id = ?
     ORDER BY a.attendance_date DESC'
  );
  $stmt->execute([$studentId]);
  $rows = $stmt->fetchAll();

  $attendanceHistory = [];
  $subjectStatsMap = [];
  foreach ($rows ?: [] as $r) {
    $attendanceHistory[] = [
      'id' => (string) $r['id'],
      'date' => (string) $r['date'],
      'subjectName' => (string) $r['subjectName'],
      'subjectCode' => (string) $r['subjectCode'],
      'status' => (string) $r['status'],
    ];

    $sid = (string) $r['subjectId'];
    if (!isset($subjectStatsMap[$sid])) {
      $subjectStatsMap[$sid] = [
        'id' => $sid,
        'name' => (string) $r['subjectName'],
        'code' => (string) $r['subjectCode'],
        'present' => 0,
        'total' => 0,
        'rate' => 0,
      ];
    }
    $subjectStatsMap[$sid]['total']++;
    if (($r['status'] ?? '') === 'present') $subjectStatsMap[$sid]['present']++;
    $t = (int) $subjectStatsMap[$sid]['total'];
    $p = (int) $subjectStatsMap[$sid]['present'];
    $subjectStatsMap[$sid]['rate'] = $t > 0 ? (int) round(($p / $t) * 100) : 0;
  }

  json([
    'attendanceHistory' => $attendanceHistory,
    'subjectStats' => array_values($subjectStatsMap),
  ], 200);
}

