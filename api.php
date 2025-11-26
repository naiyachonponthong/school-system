<?php
// 1. เริ่มต้น Buffer เพื่อป้องกันอักขระขยะ (BOM/Whitespace) หลุดไปก่อน JSON
ob_start();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

session_start();

// โหลดไฟล์เชื่อมต่อฐานข้อมูลและฟังก์ชันเสริม
require_once 'backend/db.php';
require_once 'backend/functions.php';

// รับค่า JSON จาก Frontend
$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';
$token = $input['token'] ?? '';
$params = $input['params'] ?? [];

// ตัวแปรสำหรับส่งผลลัพธ์
$response = ['success' => false, 'message' => 'Invalid Action'];

// --- Helper Functions ภายใน API ---

function validateSession($token) {
    // ตรวจสอบ Session ID และดูว่ามี User อยู่ใน Session ไหม
    if (session_id() === $token && (isset($_SESSION['user']) || isset($_SESSION['student']))) {
        return $_SESSION['user'] ?? $_SESSION['student'];
    }
    return false;
}

// ฟังก์ชันแปลงข้อมูลจาก DB (ที่มี JSON Column) ให้เป็น Object ปกติ
function expandJsonColumns($data, $jsonColName) {
    if (empty($data)) return [];
    
    // ถ้าข้อมูลมาเป็นแถวเดียว (Assoc Array)
    if (isset($data[$jsonColName])) {
        $json = json_decode($data[$jsonColName], true) ?? [];
        unset($data[$jsonColName]);
        return array_merge($data, $json);
    }

    // ถ้าข้อมูลมาเป็นหลายแถว (Array of Assoc Arrays)
    foreach ($data as &$row) {
        if (isset($row[$jsonColName])) {
            $json = json_decode($row[$jsonColName], true) ?? [];
            unset($row[$jsonColName]);
            $row = array_merge($row, $json);
        }
    }
    return $data;
}

try {
    switch ($action) {
        // ==========================================
        // 🔐 AUTHENTICATION
        // ==========================================
        case 'login':
            $u = $params[0];
            $p = $params[1];
            
            // ค้นหา User ที่ Active
            $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? AND active = 1");
            $stmt->execute([$u]);
            $user = $stmt->fetch();

            // ตรวจสอบรหัสผ่าน (ใช้ password_verify)
            if ($user && password_verify($p, $user['password'])) {
                session_regenerate_id();
                unset($user['password']); // ลบรหัสผ่านออกก่อนส่งกลับ
                $_SESSION['user'] = $user;
                
                // อัปเดตเวลาล็อกอินล่าสุด
                $pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?")->execute([$user['id']]);
                
                $response = ['success' => true, 'sessionToken' => session_id(), 'user' => $user];
            } else {
                $response['message'] = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
            }
            break;

        case 'loginStudent':
            $code = $params[0];
            $card = $params[1];
            
            // ค้นหานักเรียน
            $stmt = $pdo->prepare("SELECT * FROM students WHERE student_code = ? AND id_card = ? AND status = 'active'");
            $stmt->execute([$code, $card]);
            $stu = $stmt->fetch();
            
            if ($stu) {
                session_regenerate_id();
                
                // ขยายข้อมูล JSON (ถ้ามี)
                $stu = expandJsonColumns($stu, 'data_json');
                
                // จัดรูปแบบข้อมูลให้เหมือน User Object
                $userData = [
                    'id' => $stu['id'],
                    'user_id' => $stu['id'],
                    'username' => $stu['student_code'],
                    'name' => trim(($stu['prefix'] ?? '') . ' ' . $stu['firstname'] . ' ' . $stu['lastname']),
                    'role' => 'student',
                    'photo_url' => $stu['photo_url'],
                    'class_id' => null // จะไปหาเพิ่มด้านล่าง
                ];

                // หา Class ID
                $cls = $pdo->prepare("SELECT id FROM classes WHERE level=? AND room=?");
                $cls->execute([$stu['level'], $stu['room']]);
                if ($c = $cls->fetch()) {
                    $userData['class_id'] = $c['id'];
                }

                $_SESSION['student'] = $userData;
                $response = ['success' => true, 'sessionToken' => session_id(), 'user' => $userData];
            } else {
                $response['message'] = 'รหัสนักเรียนหรือเลขบัตรประชาชนไม่ถูกต้อง';
            }
            break;

        case 'validateSession':
            $user = validateSession($token); // เรียก Helper Function ด้านบน
            
            if ($user) {
                // 1. กรณีเป็นนักเรียน (Student)
                if (isset($user['role']) && $user['role'] === 'student') {
                    // ดึงข้อมูลล่าสุดจาก DB (เผื่อมีการย้ายห้อง หรือแก้ชื่อ)
                    $stmt = $pdo->prepare("SELECT * FROM students WHERE id = ? AND status = 'active'");
                    $stmt->execute([$user['id']]);
                    $stu = $stmt->fetch();

                    if ($stu) {
                        // ขยาย JSON data
                        $stu = expandJsonColumns($stu, 'data_json');

                        // อัปเดตข้อมูลใน Session ให้สดใหม่
                        $user['name'] = trim(($stu['prefix'] ?? '') . ' ' . $stu['firstname'] . ' ' . $stu['lastname']);
                        $user['photo_url'] = $stu['photo_url'];
                        $user['student_code'] = $stu['student_code'];
                        
                        // อัปเดต class_id (เผื่อมีการย้ายห้อง)
                        $cls = $pdo->prepare("SELECT id FROM classes WHERE level=? AND room=?");
                        $cls->execute([$stu['level'], $stu['room']]);
                        if ($c = $cls->fetch()) {
                            $user['class_id'] = $c['id'];
                        }
                        
                        $_SESSION['student'] = $user; // บันทึกกลับลง Session
                    } else {
                        // ถ้านักเรียนถูกลบหรือ inactive ให้เด้งออก
                        session_destroy();
                        $response = ['success' => false, 'message' => 'Account inactive'];
                        break;
                    }
                } 
                // 2. กรณีเป็นครู/แอดมิน (User)
                else {
                    // [⭐️ สำคัญ] อัปเดตเวลา Online ล่าสุด (Heartbeat)
                    $pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?")->execute([$user['id']]);

                    // ดึงข้อมูลล่าสุดจาก DB
                    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ? AND active = 1");
                    $stmt->execute([$user['id']]);
                    $usr = $stmt->fetch();

                    if ($usr) {
                        unset($usr['password']); // ลบรหัสผ่านออกเพื่อความปลอดภัย
                        $user = $usr;
                        $_SESSION['user'] = $user; // บันทึกกลับลง Session
                    } else {
                        // ถ้า User ถูกระงับหรือลบ ให้เด้งออก
                        session_destroy();
                        $response = ['success' => false, 'message' => 'Account suspended'];
                        break;
                    }
                }

                $response = ['success' => true, 'user' => $user];
            } else {
                $response = ['success' => false, 'message' => 'Session expired'];
            }
            break;

        case 'logout':
            session_destroy();
            $response = ['success' => true];
            break;

        case 'changePassword':
            $user = validateSession($token);
            if (!$user) { $response['message'] = 'Unauthorized'; break; }
            
            $oldPass = $params[0];
            $newPass = $params[1];
            
            // ตรวจสอบรหัสเดิม
            $stmt = $pdo->prepare("SELECT password FROM users WHERE id = ?");
            $stmt->execute([$user['id']]);
            $currentHash = $stmt->fetchColumn();
            
            if (password_verify($oldPass, $currentHash)) {
                $newHash = password_hash($newPass, PASSWORD_DEFAULT);
                $pdo->prepare("UPDATE users SET password = ? WHERE id = ?")->execute([$newHash, $user['id']]);
                $response = ['success' => true, 'message' => 'เปลี่ยนรหัสผ่านสำเร็จ'];
            } else {
                $response['message'] = 'รหัสผ่านเดิมไม่ถูกต้อง';
            }
            break;

        // ==========================================
        // 👥 USER MANAGEMENT
        // ==========================================
        case 'getUsers':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $stmt = $pdo->query("SELECT id, username, role, name, email, phone, photo_url, active, last_login FROM users ORDER BY created_at DESC");
            $response = ['success' => true, 'data' => $stmt->fetchAll()];
            break;
			
		case 'getActiveUserCount':
            // นับจำนวนคนที่ Active (Login) ภายใน 10 นาทีล่าสุด
            try {
                $stmt = $pdo->query("SELECT COUNT(*) as c FROM users WHERE last_login > DATE_SUB(NOW(), INTERVAL 10 MINUTE)");
                $count = $stmt->fetch()['c'];
                
                // ส่งค่ากลับ (อย่างน้อยต้องเป็น 1 คือตัวเราเอง)
                $response = ['success' => true, 'data' => $count > 0 ? $count : 1];
            } catch (Exception $e) {
                // กรณี Error ให้ส่งค่า 1 ไปก่อน
                $response = ['success' => true, 'data' => 1];
            }
            break;	
			
		// ==========================================
        // 🕵️ PROFILE MANAGEMENT
        // ==========================================
        case 'getProfileData':
            $user = validateSession($token);
            if (!$user) { $response['message'] = 'Unauthorized'; break; }
            
            $userId = $user['id'];
            $userRole = $user['role'];
            
            $data = [];
            
            if ($userRole === 'student') {
                // ดึงข้อมูลนักเรียน (ละเอียด)
                $stmt = $pdo->prepare("SELECT * FROM students WHERE id = ?");
                $stmt->execute([$userId]);
                $student = expandJsonColumns($stmt->fetch(), 'data_json');
                
                // จัดรูปแบบให้เหมือน User Object
                if ($student) {
                    $student['name'] = trim(($student['prefix'] ?? '') . ' ' . $student['firstname'] . ' ' . $student['lastname']);
                    $student['username'] = $student['student_code'];
                    $student['role'] = 'student';
                    $data['user'] = $student;
                }
                $data['subjects'] = [];
                $data['homeroom'] = [];

            } else {
                // ดึงข้อมูล User (ครู/Admin)
                $stmt = $pdo->prepare("SELECT id, username, role, name, email, phone, photo_url, last_login FROM users WHERE id = ?");
                $stmt->execute([$userId]);
                $data['user'] = $stmt->fetch();

                // ดึงวิชาที่สอน
                $subStmt = $pdo->prepare("SELECT * FROM subjects WHERE teacher_id = ? AND status = 'active'");
                $subStmt->execute([$userId]);
                $data['subjects'] = $subStmt->fetchAll();

                // ดึงห้องที่ประจำชั้น
                $clsStmt = $pdo->prepare("SELECT * FROM classes WHERE homeroom_teacher_id = ? AND status = 'active'");
                $clsStmt->execute([$userId]);
                $data['homeroom'] = $clsStmt->fetchAll();
            }
            
            $response = ['success' => true, 'data' => $data];
            break;	

        case 'getTeachers':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $stmt = $pdo->query("SELECT id, name, role FROM users WHERE role IN ('teacher', 'homeroom', 'admin', 'principal') AND active=1 ORDER BY name");
            $response = ['success' => true, 'data' => $stmt->fetchAll()];
            break;

        case 'createUser':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $d = $params[0];
            
            // Check duplicate username
            $chk = $pdo->prepare("SELECT id FROM users WHERE username = ?");
            $chk->execute([$d['username']]);
            if($chk->fetch()) { $response['message'] = 'Username นี้มีอยู่แล้ว'; break; }

            $id = uuid();
            $hash = password_hash($d['password'], PASSWORD_DEFAULT);
            $photo = isset($d['photo_base64']) ? uploadBase64($d['photo_base64']) : '';

            $sql = "INSERT INTO users (id, username, password, role, name, email, phone, photo_url, active) VALUES (?,?,?,?,?,?,?,?,?)";
            $pdo->prepare($sql)->execute([$id, $d['username'], $hash, $d['role'], $d['name'], $d['email'], $d['phone'], $photo, 1]);
            $response = ['success' => true];
            break;

        case 'updateUser':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $id = $params[0];
            $d = $params[1];
            
            $updates = [];
            $vals = [];
            
            // Fields to update
            if (isset($d['name'])) { $updates[] = "name=?"; $vals[] = $d['name']; }
            if (isset($d['email'])) { $updates[] = "email=?"; $vals[] = $d['email']; }
            if (isset($d['phone'])) { $updates[] = "phone=?"; $vals[] = $d['phone']; }
            if (isset($d['role'])) { $updates[] = "role=?"; $vals[] = $d['role']; }
            if (isset($d['active'])) { $updates[] = "active=?"; $vals[] = $d['active'] ? 1 : 0; }
            if (isset($d['photo_base64']) && $d['photo_base64']) {
                $photo = uploadBase64($d['photo_base64']);
                if($photo) { $updates[] = "photo_url=?"; $vals[] = $photo; }
            }

            if (!empty($updates)) {
                $sql = "UPDATE users SET " . implode(", ", $updates) . " WHERE id=?";
                $vals[] = $id;
                $pdo->prepare($sql)->execute($vals);
            }
            
            // Fetch updated user
            $stmt = $pdo->prepare("SELECT id, username, role, name, email, phone, photo_url, active FROM users WHERE id=?");
            $stmt->execute([$id]);
            $response = ['success' => true, 'data' => $stmt->fetch()];
            break;
			
		case 'changePassword':
            $user = validateSession($token);
            if (!$user) { $response['message'] = 'Unauthorized'; break; }
            
            // ป้องกันนักเรียนเปลี่ยนรหัส (เพราะนักเรียนใช้เลขบัตรประชาชน Login)
            if (isset($user['role']) && $user['role'] === 'student') {
                $response['message'] = 'ระบบนักเรียนใช้เลขบัตรประชาชนในการเข้าสู่ระบบ ไม่สามารถเปลี่ยนรหัสผ่านได้';
                break;
            }

            $oldPass = $params[0];
            $newPass = $params[1];

            try {
                // 1. ดึงรหัสผ่านปัจจุบันจาก DB
                $stmt = $pdo->prepare("SELECT password FROM users WHERE id = ?");
                $stmt->execute([$user['id']]);
                $currentHash = $stmt->fetchColumn();

                // 2. ตรวจสอบรหัสเดิม
                if ($currentHash && password_verify($oldPass, $currentHash)) {
                    // 3. Hash รหัสใหม่และบันทึก
                    $newHash = password_hash($newPass, PASSWORD_DEFAULT);
                    $pdo->prepare("UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?")->execute([$newHash, $user['id']]);
                    $response = ['success' => true, 'message' => 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่'];
                } else {
                    $response = ['success' => false, 'message' => 'รหัสผ่านเดิมไม่ถูกต้อง'];
                }
            } catch (Exception $e) {
                $response['message'] = 'Database Error: ' . $e->getMessage();
            }
            break;	

        case 'deleteUser':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $id = $params[0];
            $pdo->prepare("DELETE FROM users WHERE id=?")->execute([$id]);
            $response = ['success' => true];
            break;

        // ==========================================
        // 🎓 STUDENT MANAGEMENT
        // ==========================================
        case 'getStudents':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $stmt = $pdo->query("SELECT * FROM students WHERE status != 'deleted' ORDER BY level, room, student_number");
            $students = $stmt->fetchAll();
            $response = ['success' => true, 'data' => expandJsonColumns($students, 'data_json')];
            break;

        case 'createStudent':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $d = $params[0];
            
            // Check duplicate
            $chk = $pdo->prepare("SELECT id FROM students WHERE student_code = ?");
            $chk->execute([$d['student_code']]);
            if($chk->fetch()) { $response['message'] = 'รหัสนักเรียนซ้ำ'; break; }

            $id = uuid();
            $photo = isset($d['photo_base64']) ? uploadBase64($d['photo_base64']) : '';
            
            // แยก Field หลักกับ JSON
            $mainFields = ['student_code', 'id_card', 'prefix', 'firstname', 'lastname', 'level', 'room', 'student_number', 'status'];
            $jsonData = $d;
            foreach ($mainFields as $k) unset($jsonData[$k]);
            unset($jsonData['photo_base64']);

            $sql = "INSERT INTO students (id, student_code, id_card, prefix, firstname, lastname, level, room, student_number, photo_url, data_json, status) 
                    VALUES (?,?,?,?,?,?,?,?,?,?,?, 'active')";
            $pdo->prepare($sql)->execute([
                $id, $d['student_code'], $d['id_card'] ?? '', $d['prefix'], $d['firstname'], $d['lastname'],
                $d['level'], $d['room'], $d['student_number'], $photo, json_encode($jsonData, JSON_UNESCAPED_UNICODE)
            ]);
            $response = ['success' => true];
            break;

        case 'updateStudent':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $id = $params[0];
            $d = $params[1];
            
            // ดึงข้อมูลเก่าเพื่อรวม JSON
            $stmt = $pdo->prepare("SELECT data_json FROM students WHERE id=?");
            $stmt->execute([$id]);
            $oldRow = $stmt->fetch();
            $oldJson = json_decode($oldRow['data_json'] ?? '{}', true);

            $photo = isset($d['photo_base64']) ? uploadBase64($d['photo_base64']) : null;
            
            $mainFields = ['student_code', 'id_card', 'prefix', 'firstname', 'lastname', 'level', 'room', 'student_number', 'status'];
            foreach ($d as $k => $v) {
                if (!in_array($k, $mainFields) && $k != 'photo_base64') {
                    $oldJson[$k] = $v;
                }
            }

            $sql = "UPDATE students SET student_code=?, id_card=?, prefix=?, firstname=?, lastname=?, level=?, room=?, student_number=?, data_json=?, status=?";
            $vals = [
                $d['student_code'], $d['id_card'], $d['prefix'], $d['firstname'], $d['lastname'],
                $d['level'], $d['room'], $d['student_number'], json_encode($oldJson, JSON_UNESCAPED_UNICODE), $d['status'] ?? 'active'
            ];

            if ($photo) { $sql .= ", photo_url=?"; $vals[] = $photo; }
            $sql .= " WHERE id=?"; $vals[] = $id;

            $pdo->prepare($sql)->execute($vals);
            
            // ส่งข้อมูลกลับ
            $stmt = $pdo->prepare("SELECT * FROM students WHERE id=?");
            $stmt->execute([$id]);
            $response = ['success' => true, 'data' => expandJsonColumns($stmt->fetch(), 'data_json')];
            break;

        case 'deleteStudent':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $id = $params[0];
            $pdo->prepare("UPDATE students SET status='deleted' WHERE id=?")->execute([$id]);
            $response = ['success' => true];
            break;
            
        case 'batchCreateStudents':
            // นำเข้า CSV
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $students = $params[0];
            $added = 0;
            $failed = 0;
            $errors = [];
            
            foreach($students as $idx => $d) {
                try {
                    // Check duplicate
                    $chk = $pdo->prepare("SELECT id FROM students WHERE student_code = ?");
                    $chk->execute([$d['student_code']]);
                    if($chk->fetch()) { 
                        $failed++; 
                        $errors[] = "แถวที่ " . ($idx+1) . ": รหัสซ้ำ (" . $d['student_code'] . ")";
                        continue; 
                    }
                    
                    $id = uuid();
                    $mainFields = ['student_code', 'id_card', 'prefix', 'firstname', 'lastname', 'level', 'room', 'student_number'];
                    $jsonData = $d;
                    foreach ($mainFields as $k) unset($jsonData[$k]);
                    
                    $sql = "INSERT INTO students (id, student_code, id_card, prefix, firstname, lastname, level, room, student_number, data_json, status) 
                            VALUES (?,?,?,?,?,?,?,?,?,?, 'active')";
                    $pdo->prepare($sql)->execute([
                        $id, $d['student_code'], $d['id_card'] ?? '', $d['prefix'], $d['firstname'], $d['lastname'],
                        $d['level'], $d['room'], $d['student_number'], json_encode($jsonData, JSON_UNESCAPED_UNICODE)
                    ]);
                    $added++;
                } catch(Exception $e) {
                    $failed++;
                    $errors[] = "แถวที่ " . ($idx+1) . ": " . $e->getMessage();
                }
            }
            
            $response = ['success' => true, 'summary' => ['added' => $added, 'failed' => $failed, 'errors' => $errors]];
            break;

        // ==========================================
        // 🏫 CLASSES MANAGEMENT
        // ==========================================
        case 'getClasses':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $stmt = $pdo->query("SELECT * FROM classes ORDER BY level, room");
            $response = ['success' => true, 'data' => $stmt->fetchAll()];
            break;

        case 'createClass':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $d = $params[0];
            $id = uuid();
            $pdo->prepare("INSERT INTO classes (id, level, room, year, homeroom_teacher_id, homeroom_teacher_name, capacity) VALUES (?,?,?,?,?,?,?)")
                ->execute([$id, $d['level'], $d['room'], $d['year'], $d['homeroom_teacher_id'], $d['homeroom_teacher_name'], $d['capacity']]);
            $response = ['success' => true];
            break;

        case 'updateClass':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $id = $params[0];
            $d = $params[1];
            $sql = "UPDATE classes SET level=?, room=?, year=?, homeroom_teacher_id=?, homeroom_teacher_name=?, capacity=?, status=? WHERE id=?";
            $pdo->prepare($sql)->execute([$d['level'], $d['room'], $d['year'], $d['homeroom_teacher_id'], $d['homeroom_teacher_name'], $d['capacity'], $d['status'], $id]);
            $response = ['success' => true];
            break;

        case 'deleteClass':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $id = $params[0];
            // Check if students exist
            $c = $pdo->prepare("SELECT level, room FROM classes WHERE id=?");
            $c->execute([$id]);
            $cls = $c->fetch();
            
            $chk = $pdo->prepare("SELECT id FROM students WHERE level=? AND room=? AND status='active'");
            $chk->execute([$cls['level'], $cls['room']]);
            if($chk->fetch()) {
                $response['message'] = 'ไม่สามารถลบห้องเรียนที่มีนักเรียนอยู่ได้';
            } else {
                $pdo->prepare("DELETE FROM classes WHERE id=?")->execute([$id]);
                $response = ['success' => true];
            }
            break;
			
		// ==========================================
        // 📅 TIMETABLES MANAGEMENT
        // ==========================================
        
        case 'getTimetable':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $teacherId = $params[0]; 
            $year = $params[1]; 
            $sem = $params[2];
            
            // ถ้า teacherId เป็น null หรือ 'null' ให้ดึงทั้งหมด (สำหรับ getAllTimetableSlots)
            $sql = "SELECT t.*, s.subject_name, s.subject_code, c.level, c.room, u.name as teacher_name 
                    FROM timetables t
                    LEFT JOIN subjects s ON t.subject_id = s.id
                    LEFT JOIN classes c ON t.class_id = c.id
                    LEFT JOIN users u ON t.teacher_id = u.id
                    WHERE t.year = ? AND t.semester = ?";
            $args = [$year, $sem];

            if ($teacherId && $teacherId !== 'null') {
                $sql .= " AND t.teacher_id = ?";
                $args[] = $teacherId;
            }
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute($args);
            $slots = $stmt->fetchAll();
            
            // จัดรูปแบบข้อมูลให้เหมือน JS เดิม (class_name)
            foreach($slots as &$slot) {
                $slot['class_name'] = ($slot['level'] && $slot['room']) ? "{$slot['level']}/{$slot['room']}" : 'N/A';
            }
            
            $response = ['success' => true, 'data' => $slots];
            break;

        case 'getAllTimetableSlots':
            // ใช้ Logic เดียวกับ getTimetable แต่ไม่กรอง Teacher
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $year = $params[0]; 
            $sem = $params[1];
            
            $sql = "SELECT t.*, s.subject_name, s.subject_code, c.level, c.room, u.name as teacher_name 
                    FROM timetables t
                    LEFT JOIN subjects s ON t.subject_id = s.id
                    LEFT JOIN classes c ON t.class_id = c.id
                    LEFT JOIN users u ON t.teacher_id = u.id
                    WHERE t.year = ? AND t.semester = ?";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$year, $sem]);
            $slots = $stmt->fetchAll();
            
            foreach($slots as &$slot) {
                $slot['class_name'] = ($slot['level'] && $slot['room']) ? "{$slot['level']}/{$slot['room']}" : 'N/A';
            }
            
            $response = ['success' => true, 'data' => $slots];
            break;

        case 'getTeacherTimetable':
            // ดึงตารางสอนของ User ปัจจุบัน
            $user = validateSession($token);
            if (!$user) { $response['message'] = 'Unauthorized'; break; }
            
            // ดึง Config เพื่อเอาปีปัจจุบัน
            $stmtC = $pdo->query("SELECT config_json FROM config LIMIT 1");
            $config = json_decode($stmtC->fetch()['config_json'], true);
            $year = $config['current_year'];
            $sem = $config['current_semester'];
            
            $sql = "SELECT t.*, s.subject_name, s.subject_code, c.level, c.room 
                    FROM timetables t
                    LEFT JOIN subjects s ON t.subject_id = s.id
                    LEFT JOIN classes c ON t.class_id = c.id
                    WHERE t.teacher_id = ? AND t.year = ? AND t.semester = ?";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$user['id'], $year, $sem]);
            $timetable = $stmt->fetchAll();
            
            foreach($timetable as &$slot) {
                $slot['class_name'] = "{$slot['level']}/{$slot['room']}";
            }
            
            $response = ['success' => true, 'data' => $timetable];
            break;

        case 'saveTimetableSlot':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $d = $params[0];
            
            if ($d['id']) {
                // Update
                $sql = "UPDATE timetables SET teacher_id=?, class_id=?, subject_id=?, day=?, period=?, year=?, semester=? WHERE id=?";
                $pdo->prepare($sql)->execute([$d['teacher_id'], $d['class_id'], $d['subject_id'], $d['day'], $d['period'], $d['year'], $d['semester'], $d['id']]);
            } else {
                // Create
                $d['id'] = uuid();
                $sql = "INSERT INTO timetables (id, teacher_id, class_id, subject_id, day, period, year, semester) VALUES (?,?,?,?,?,?,?,?)";
                $pdo->prepare($sql)->execute([$d['id'], $d['teacher_id'], $d['class_id'], $d['subject_id'], $d['day'], $d['period'], $d['year'], $d['semester']]);
            }
            $response = ['success' => true, 'data' => $d];
            break;

        case 'deleteTimetableSlot':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $id = $params[0];
            $pdo->prepare("DELETE FROM timetables WHERE id=?")->execute([$id]);
            $response = ['success' => true];
            break;
            
        case 'getStudentTimetable':
            // สำหรับนักเรียนดูตารางเรียน
            $user = validateSession($token);
            if (!$user || $user['role'] !== 'student') { $response['message'] = 'Unauthorized'; break; }
            
            // Get Config
            $stmtC = $pdo->query("SELECT config_json FROM config LIMIT 1");
            $config = json_decode($stmtC->fetch()['config_json'], true);
            
            // Get Student Class
            $stmtS = $pdo->prepare("SELECT level, room FROM students WHERE id = ?");
            $stmtS->execute([$user['id']]);
            $stu = $stmtS->fetch();
            
            // Find Class ID based on level/room/year
            $stmtCls = $pdo->prepare("SELECT id FROM classes WHERE level=? AND room=? AND year=?");
            $stmtCls->execute([$stu['level'], $stu['room'], $config['current_year']]);
            $cls = $stmtCls->fetch();
            
            if (!$cls) {
                $response = ['success' => false, 'message' => 'ไม่พบข้อมูลห้องเรียนในปีการศึกษานี้'];
                break;
            }
            
            // Get Timetable
            $sql = "SELECT t.*, s.subject_name, s.subject_code, u.name as teacher_name 
                    FROM timetables t
                    LEFT JOIN subjects s ON t.subject_id = s.id
                    LEFT JOIN users u ON t.teacher_id = u.id
                    WHERE t.class_id = ? AND t.year = ? AND t.semester = ?";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$cls['id'], $config['current_year'], $config['current_semester']]);
            $timetable = $stmt->fetchAll();
            
            $response = ['success' => true, 'data' => [
                'timetable' => $timetable,
                'student' => $user,
                'classInfo' => $stu,
                'config' => $config
            ]];
            break;	
			
		case 'batchUpdateClassYear':
            // ตรวจสอบสิทธิ์ (Admin เท่านั้น)
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            
            $oldYear = $params[0];
            $newYear = $params[1];

            if (!$oldYear || !$newYear) {
                $response['message'] = 'กรุณาระบุปีการศึกษาให้ครบถ้วน';
                break;
            }

            if ($oldYear == $newYear) {
                $response['message'] = 'ปีการศึกษาใหม่ต้องไม่ซ้ำกับปีเดิม';
                break;
            }

            try {
                // อัปเดตปีการศึกษาของห้องเรียนทั้งหมด ที่ตรงกับปีเก่า
                $sql = "UPDATE classes SET year = ?, updated_at = NOW() WHERE year = ?";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$newYear, $oldYear]);
                
                $count = $stmt->rowCount();

                if ($count > 0) {
                    // (Optional) อัปเดต Config ให้เป็นปีปัจจุบันด้วยเลยไหม?
                    // $json = json_encode(['current_year' => $newYear], JSON_UNESCAPED_UNICODE);
                    // แต่วิธีนี้อาจจะไปทับ config อื่นๆ เอาแค่ update classes ก่อนครับ
                    
                    $response = ['success' => true, 'message' => "อัปเดตห้องเรียนจำนวน $count ห้อง เป็นปี $newYear สำเร็จ"];
                } else {
                    $response = ['success' => false, 'message' => "ไม่พบห้องเรียนในปี $oldYear"];
                }

            } catch (Exception $e) {
                $response['message'] = 'Database Error: ' . $e->getMessage();
            }
            break;	
		
		case 'batchMoveStudents':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            
            $studentIds = $params[0]; // Array ของ ID นักเรียน
            $targetClassId = $params[1]; // ID ห้องเรียนปลายทาง

            if (empty($studentIds) || !$targetClassId) {
                $response['message'] = 'ข้อมูลไม่ครบถ้วน';
                break;
            }

            try {
                // 1. ดึงข้อมูลห้องเรียนปลายทาง (Level, Room)
                $stmt = $pdo->prepare("SELECT level, room FROM classes WHERE id = ?");
                $stmt->execute([$targetClassId]);
                $targetClass = $stmt->fetch();

                if (!$targetClass) {
                    $response['message'] = 'ไม่พบห้องเรียนปลายทาง';
                    break;
                }

                // 2. ทำการย้ายนักเรียน (Update ทีเดียวหลายคนโดยใช้ IN clause)
                // สร้างเครื่องหมาย ? ตามจำนวนนักเรียน เช่น ?,?,?
                $placeholders = implode(',', array_fill(0, count($studentIds), '?'));
                
                // SQL Update
                $sql = "UPDATE students SET level = ?, room = ?, updated_at = NOW() WHERE id IN ($placeholders)";
                
                // เตรียม Parameter: [level, room, id1, id2, id3...]
                $sqlParams = array_merge([$targetClass['level'], $targetClass['room']], $studentIds);
                
                $stmt = $pdo->prepare($sql);
                $stmt->execute($sqlParams);

                $response = ['success' => true, 'message' => 'ย้ายนักเรียนสำเร็จ ' . count($studentIds) . ' คน'];

            } catch (Exception $e) {
                $response['message'] = 'Database Error: ' . $e->getMessage();
            }
            break;

        // ==========================================
        // 📚 SUBJECTS MANAGEMENT
        // ==========================================
        case 'getSubjects':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $stmt = $pdo->query("SELECT * FROM subjects WHERE status='active'");
            $data = $stmt->fetchAll();
            foreach($data as &$r) $r = expandJsonColumns($r, 'indicators_json');
            $response = ['success' => true, 'data' => $data];
            break;

        case 'createSubject':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $d = $params[0];
            $id = uuid();
            $pdo->prepare("INSERT INTO subjects (id, subject_code, subject_name, subject_group, credit, level, status) VALUES (?,?,?,?,?,?,'active')")
                ->execute([$id, $d['subject_code'], $d['subject_name'], $d['subject_group'], $d['credit'], $d['level']]);
            $response = ['success' => true];
            break;

        case 'updateSubject':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $id = $params[0];
            $d = $params[1];
            
            // Handle indicators
            $json = null;
            if(isset($d['indicators_by_semester'])) {
                $json = json_encode(['indicators_by_semester' => $d['indicators_by_semester']], JSON_UNESCAPED_UNICODE);
            }

            $sql = "UPDATE subjects SET subject_code=?, subject_name=?, subject_group=?, credit=?, level=?, teacher_id=?, teacher_name=?, status=?";
            $vals = [$d['subject_code'], $d['subject_name'], $d['subject_group'], $d['credit'], $d['level'], $d['teacher_id'], $d['teacher_name'], $d['status'] ?? 'active'];
            
            if($json) { $sql .= ", indicators_json=?"; $vals[] = $json; }
            $sql .= " WHERE id=?"; $vals[] = $id;
            
            $pdo->prepare($sql)->execute($vals);
            
            // Return updated data
            $stmt = $pdo->prepare("SELECT * FROM subjects WHERE id=?");
            $stmt->execute([$id]);
            $response = ['success' => true, 'data' => expandJsonColumns($stmt->fetch(), 'indicators_json')];
            break;
			
		case 'batchUpdateTeacherAssignments':
            // ตรวจสอบสิทธิ์ (Admin หรือ Registrar เท่านั้น)
            $user = validateSession($token);
            if (!$user || !in_array($user['role'], ['admin', 'registrar'])) {
                $response['message'] = 'Unauthorized';
                break;
            }

            $teacherId = $params[0];
            $teacherName = $params[1];
            $subjectIds = $params[2] ?? []; // Array ของ ID วิชาที่เลือก

            try {
                $pdo->beginTransaction();

                if (empty($subjectIds)) {
                    // กรณี: ไม่เลือกวิชาเลย -> ลบครูคนนี้ออกจากทุกวิชาที่เคยสอน
                    $sqlUnassign = "UPDATE subjects SET teacher_id = NULL, teacher_name = NULL WHERE teacher_id = ?";
                    $stmt = $pdo->prepare($sqlUnassign);
                    $stmt->execute([$teacherId]);
                } else {
                    // 1. Unassign: ลบชื่อครูออกจากวิชาที่ *เคยสอน* แต่ *ไม่ได้ถูกเลือก* ในครั้งนี้
                    // WHERE teacher_id = ครูคนนี้ AND id NOT IN (รายชื่อวิชาใหม่)
                    $placeholders = str_repeat('?,', count($subjectIds) - 1) . '?';
                    $sqlUnassign = "UPDATE subjects SET teacher_id = NULL, teacher_name = NULL 
                                    WHERE teacher_id = ? AND id NOT IN ($placeholders)";
                    
                    // รวม params: [teacherId, ...subjectIds]
                    $paramsUnassign = array_merge([$teacherId], $subjectIds);
                    $stmt = $pdo->prepare($sqlUnassign);
                    $stmt->execute($paramsUnassign);

                    // 2. Assign: ใส่ชื่อครูลงในวิชาที่ถูกเลือก
                    // WHERE id IN (รายชื่อวิชาใหม่)
                    // หมายเหตุ: การทำแบบนี้จะทับชื่อครูเดิมถ้ารายวิชานั้นมีครูคนอื่นสอนอยู่ (ซึ่งถูกต้องสำหรับฟังก์ชันนี้ที่เป็นการ Force Assign)
                    $sqlAssign = "UPDATE subjects SET teacher_id = ?, teacher_name = ? 
                                  WHERE id IN ($placeholders)";
                    
                    // รวม params: [teacherId, teacherName, ...subjectIds]
                    $paramsAssign = array_merge([$teacherId, $teacherName], $subjectIds);
                    $stmt = $pdo->prepare($sqlAssign);
                    $stmt->execute($paramsAssign);
                }

                $pdo->commit();
                $response = ['success' => true, 'message' => 'บันทึกภาระงานสอนสำเร็จ'];

            } catch (Exception $e) {
                $pdo->rollBack();
                $response['message'] = 'Database Error: ' . $e->getMessage();
            }
            break;	
            
        case 'addIndicatorToSubject':
            // params: subjectId, name, max, semester
            $subId = $params[0]; $name = $params[1]; $max = $params[2]; $sem = (string)$params[3]; // บังคับเป็น string
            
            $stmt = $pdo->prepare("SELECT indicators_json FROM subjects WHERE id=?");
            $stmt->execute([$subId]);
            $row = $stmt->fetch();
            $json = json_decode($row['indicators_json'] ?? '{}', true);
            
            // ถ้ายังไม่มีโครงสร้างแยกเทอม ให้สร้างขึ้นมา
            if(!isset($json['indicators_by_semester'])) {
                $json['indicators_by_semester'] = [
                    "1" => [],
                    "2" => []
                ];
                // ย้ายข้อมูลเก่า (ถ้ามี) ไปเข้าเทอม 1 (หรือจะทิ้งก็ได้ถ้าอยากเริ่มใหม่)
                if(isset($json['indicators']) && is_array($json['indicators'])) {
                    $json['indicators_by_semester']["1"] = $json['indicators'];
                }
                // ลบ key เก่าทิ้ง เพื่อไม่ให้สับสน
                unset($json['indicators']);
            }
            
            // สร้าง array สำหรับเทอมที่เลือก ถ้ายังไม่มี
            if(!isset($json['indicators_by_semester'][$sem])) {
                $json['indicators_by_semester'][$sem] = [];
            }
            
            // เพิ่มตัวชี้วัดใหม่
            $json['indicators_by_semester'][$sem][] = [
                'id' => uuid(), 
                'name' => $name, 
                'max' => $max
            ];
            
            $pdo->prepare("UPDATE subjects SET indicators_json=? WHERE id=?")
                ->execute([json_encode($json, JSON_UNESCAPED_UNICODE), $subId]);
                
            $response = ['success' => true];
            break;
			
		case 'updateIndicatorInSubject':
            // params: subjectId, indicatorId, name, max, semester
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $subId = $params[0]; $indId = $params[1]; $name = $params[2]; $max = $params[3]; $sem = $params[4];

            $stmt = $pdo->prepare("SELECT indicators_json FROM subjects WHERE id=?");
            $stmt->execute([$subId]);
            $json = json_decode($stmt->fetch()['indicators_json'] ?? '{}', true);

            if (isset($json['indicators_by_semester'][$sem])) {
                foreach ($json['indicators_by_semester'][$sem] as &$ind) {
                    if ($ind['id'] === $indId) {
                        $ind['name'] = $name;
                        $ind['max'] = $max;
                        break;
                    }
                }
            }
            $pdo->prepare("UPDATE subjects SET indicators_json=? WHERE id=?")->execute([json_encode($json, JSON_UNESCAPED_UNICODE), $subId]);
            $response = ['success' => true];
            break;

        case 'deleteIndicatorFromSubject':
            // params: subjectId, indicatorId, semester
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $subId = $params[0]; $indId = $params[1]; $sem = $params[2];

            $stmt = $pdo->prepare("SELECT indicators_json FROM subjects WHERE id=?");
            $stmt->execute([$subId]);
            $json = json_decode($stmt->fetch()['indicators_json'] ?? '{}', true);

            if (isset($json['indicators_by_semester'][$sem])) {
                $newInds = [];
                foreach ($json['indicators_by_semester'][$sem] as $ind) {
                    if ($ind['id'] !== $indId) {
                        $newInds[] = $ind;
                    }
                }
                $json['indicators_by_semester'][$sem] = $newInds;
                
                // Note: In a real app, we should also clean up scores in 'scores' table JSON
                // But for now, removing definition hides it from UI.
            }
            $pdo->prepare("UPDATE subjects SET indicators_json=? WHERE id=?")->execute([json_encode($json, JSON_UNESCAPED_UNICODE), $subId]);
            $response = ['success' => true];
            break;	

        // ==========================================
        // 📝 SCORES & GRADES
        // ==========================================
        case 'getScoresForEntry':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $classId = $params[0]; 
            $subjectId = $params[1]; 
            $sem = $params[2]; // ภาคเรียนที่เลือก (1 หรือ 2)
            $year = $params[3];

            try {
                // 1. ดึงข้อมูลห้องเรียน
                $c = $pdo->prepare("SELECT level, room FROM classes WHERE id=?");
                $c->execute([$classId]);
                $cls = $c->fetch();
                
                if (!$cls) { $response['message'] = 'Class not found'; break; }
                
                // 2. ดึงรายชื่อนักเรียน
                $sStmt = $pdo->prepare("SELECT id, student_code, prefix, firstname, lastname, student_number FROM students WHERE level=? AND room=? AND status='active' ORDER BY student_number");
                $sStmt->execute([$cls['level'], $cls['room']]);
                $students = $sStmt->fetchAll();
                
                // 3. ดึงข้อมูลวิชา และจัดการตัวชี้วัดตามเทอม
                $subStmt = $pdo->prepare("SELECT * FROM subjects WHERE id=?");
                $subStmt->execute([$subjectId]);
                $subject = $subStmt->fetch();
                
                if (!$subject) { $response['message'] = 'Subject not found'; break; }

                // แปลง JSON ของตัวชี้วัด
                $indJson = json_decode($subject['indicators_json'] ?? '{}', true);
                
                // [⭐️ แก้ไข Logic การเลือกตัวชี้วัด ⭐️]
                $targetIndicators = [];

                if (isset($indJson['indicators_by_semester'])) {
                    // ถ้าเป็นโครงสร้างใหม่ (แยกเทอม) ให้ดึงเฉพาะเทอมที่เลือก
                    $targetIndicators = $indJson['indicators_by_semester'][$sem] ?? [];
                } else {
                    // ถ้าเป็นโครงสร้างเก่า (ไม่มี by_semester)
                    // - ถ้าเลือกเทอม 1 ให้แสดงของเก่า
                    // - ถ้าเลือกเทอม 2 ให้เป็นว่าง (หรือต้องไปกดซิงค์ก่อน)
                    if ($sem == '1' && isset($indJson['indicators'])) {
                        $targetIndicators = $indJson['indicators'];
                    }
                }
                
                // อัปเดต object subject ที่จะส่งกลับ ให้มี indicators แค่ของเทอมนี้
                $subject['indicators'] = $targetIndicators;
                // ลบ json ดิบออกเพื่อไม่ให้สับสน
                unset($subject['indicators_json']);
                
                // 4. ดึงคะแนนที่มีอยู่แล้ว
                $scStmt = $pdo->prepare("SELECT * FROM scores WHERE subject_id=? AND year=? AND semester=?");
                $scStmt->execute([$subjectId, $year, $sem]);
                $scores = $scStmt->fetchAll();
                
                $scoreMap = [];
                foreach($scores as $sc) {
                    $jsonScore = json_decode($sc['scores_json'] ?? '{}', true);
                    // รวมข้อมูล DB column กับ JSON data
                    $scoreMap[$sc['student_id']] = array_merge($sc, $jsonScore);
                }
                
                // 5. รวมข้อมูลนักเรียน + คะแนน
                $result = [];
                foreach($students as $stu) {
                    $fullname = trim(($stu['prefix'] ?? '') . ' ' . $stu['firstname'] . ' ' . $stu['lastname']);
                    
                    $row = [
                        'student_id' => $stu['id'], 
                        'student_code' => $stu['student_code'],
                        'student_name' => $fullname,
                        'student_number' => $stu['student_number'],
                        'scores' => ['indicators' => [], 'final' => 0], // โครงสร้างเริ่มต้น
                        'total_score' => 0, 
                        'grade' => '-', 
                        'pass_status' => 'ไม่ผ่าน'
                    ];
                    
                    if (isset($scoreMap[$stu['id']])) {
                        $ex = $scoreMap[$stu['id']];
                        $row['id'] = $ex['id']; // สำคัญสำหรับการ Update
                        $row['scores'] = $ex['scores'] ?? ['indicators' => [], 'final' => 0];
                        $row['total_score'] = $ex['total_score'];
                        $row['grade'] = $ex['grade'];
                        $row['pass_status'] = $ex['pass_status'];
                    }
                    $result[] = $row;
                }
                
                $response = ['success' => true, 'data' => ['studentsWithScores' => $result, 'subject' => $subject]];

            } catch (Exception $e) {
                $response['message'] = 'DB Error: ' . $e->getMessage();
            }
            break;

        case 'batchSaveScores':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $subId = $params[0]; $classId = $params[1]; $sem = $params[2]; $year = $params[3];
            $studentScores = $params[4];
            // params[5], params[6] ไม่ได้ใช้ที่ PHP

            $savedData = [];

            try {
                $pdo->beginTransaction();
                
                foreach ($studentScores as $item) {
                    // เช็คว่ามีข้อมูลเดิมหรือไม่
                    $chk = $pdo->prepare("SELECT id FROM scores WHERE student_id=? AND subject_id=? AND year=? AND semester=?");
                    $chk->execute([$item['student_id'], $subId, $year, $sem]);
                    $exist = $chk->fetch();
                    
                    $scoresJson = json_encode(['scores' => $item['scores']], JSON_UNESCAPED_UNICODE);
                    
                    // [⭐️ รับค่าที่ JS ส่งมาบันทึกลง Column ⭐️]
                    $totalScore = isset($item['total_score']) ? floatval($item['total_score']) : 0;
                    $grade = isset($item['grade']) ? $item['grade'] : '0';
                    $gpaValue = isset($item['gpa_value']) ? floatval($item['gpa_value']) : 0;
                    $passStatus = ($totalScore >= 50) ? 'ผ่าน' : 'ไม่ผ่าน';
                    
                    if ($exist) {
                        $sql = "UPDATE scores SET scores_json=?, total_score=?, grade=?, gpa_value=?, pass_status=?, updated_at=NOW() WHERE id=?";
                        $pdo->prepare($sql)->execute([$scoresJson, $totalScore, $grade, $gpaValue, $passStatus, $exist['id']]);
                    } else {
                        $id = uuid();
                        $sql = "INSERT INTO scores (id, student_id, subject_id, year, semester, scores_json, total_score, grade, gpa_value, pass_status) VALUES (?,?,?,?,?,?,?,?,?,?)";
                        $pdo->prepare($sql)->execute([$id, $item['student_id'], $subId, $year, $sem, $scoresJson, $totalScore, $grade, $gpaValue, $passStatus]);
                    }
                    
                    // เตรียมข้อมูลส่งกลับ
                    $item['total_score'] = $totalScore;
                    $item['grade'] = $grade;
                    $savedData[] = $item;
                }
                
                $pdo->commit();
                $response = ['success' => true, 'data' => $savedData];

            } catch (Exception $e) {
                $pdo->rollBack();
                $response['message'] = 'DB Error: ' . $e->getMessage();
            }
            break;
			
		case 'getStudentGradeReport':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            
            $studentId = $params[0];
            $year = $params[1];
            $semester = $params[2]; // '1', '2', หรือ 'all'

            try {
                // 1. ดึงข้อมูลนักเรียน
                $stmt = $pdo->prepare("SELECT * FROM students WHERE id = ?");
                $stmt->execute([$studentId]);
                $student = expandJsonColumns($stmt->fetch(), 'data_json');

                if (!$student) {
                    $response['message'] = 'ไม่พบข้อมูลนักเรียน';
                    break;
                }

                // 2. ดึงคะแนน (JOIN กับ Subjects เพื่อเอาชื่อวิชาและหน่วยกิต)
                $sql = "SELECT sc.*, s.subject_name, s.subject_code, s.credit 
                        FROM scores sc 
                        JOIN subjects s ON sc.subject_id = s.id 
                        WHERE sc.student_id = ? AND sc.year = ?";
                
                $args = [$studentId, $year];
                
                if ($semester !== 'all') {
                    $sql .= " AND sc.semester = ?";
                    $args[] = $semester;
                }
                
                $stmt = $pdo->prepare($sql);
                $stmt->execute($args);
                $scores = $stmt->fetchAll();

                // [⭐️ Logic คำนวณเกรดอัตโนมัติ ⭐️]
                foreach ($scores as &$s) {
                    $json = json_decode($s['scores_json'] ?? '{}', true);
                    $s = array_merge($s, $json);
                    unset($s['scores_json']);

                    // ดึงคะแนนรวม (ถ้าไม่มีใน DB ให้เป็น 0)
                    $total = isset($s['total_score']) ? floatval($s['total_score']) : 0;

                    // ถ้าเกรดใน DB ว่างเปล่า ให้คำนวณใหม่เดี๋ยวนี้เลย
                    if ($s['grade'] === null || $s['grade'] === '') {
                        if ($total >= 80) $g = '4';
                        elseif ($total >= 75) $g = '3.5';
                        elseif ($total >= 70) $g = '3';
                        elseif ($total >= 65) $g = '2.5';
                        elseif ($total >= 60) $g = '2';
                        elseif ($total >= 55) $g = '1.5';
                        elseif ($total >= 50) $g = '1';
                        else $g = '0';

                        $s['grade'] = $g;
                        $s['gpa_value'] = floatval($g);
                        $s['pass_status'] = ($total >= 50) ? 'ผ่าน' : 'ไม่ผ่าน';
                    }
                }

                // 3. คำนวณ GPA เฉลี่ยรวม
                $totalPoints = 0;
                $totalCredits = 0;
                
                foreach ($scores as $s) {
                    $credit = floatval($s['credit']);
                    $gpaVal = floatval($s['gpa_value']);
                    
                    if ($credit > 0) {
                        $totalPoints += ($gpaVal * $credit);
                        $totalCredits += $credit;
                    }
                }
                
                $gpaTotal = $totalCredits > 0 ? number_format($totalPoints / $totalCredits, 2) : '0.00';

                // 4. ดึงพฤติกรรม
                $targetSem = ($semester === 'all') ? '2' : $semester;
                $stmt = $pdo->prepare("SELECT * FROM behaviors WHERE student_id = ? AND year = ? AND semester = ?");
                $stmt->execute([$studentId, $year, $targetSem]);
                $behRow = $stmt->fetch();

                $behavior = null;
                if ($behRow) {
                    $behRow['traits'] = json_decode($behRow['traits_json'] ?? '{}', true);
                    unset($behRow['traits_json']);
                    $behavior = $behRow;
                }

                // 5. ดึงกิจกรรม
                $stmt = $pdo->prepare("SELECT * FROM activities WHERE student_id = ? AND year = ? AND semester = ?");
                $stmt->execute([$studentId, $year, $targetSem]);
                $actRow = $stmt->fetch();
                
                $activities = null;
                if ($actRow) {
                    $actRow['guidance'] = json_decode($actRow['guidance'] ?? '{}', true);
                    $actRow['club'] = json_decode($actRow['club'] ?? '{}', true);
                    $actRow['social_service'] = json_decode($actRow['social_service'] ?? '{}', true);
                    $actRow['scout'] = json_decode($actRow['scout'] ?? '{}', true);
                    $activities = $actRow;
                }

                $response = ['success' => true, 'data' => [
                    'studentInfo' => $student,
                    'scores' => $scores,
                    'behavior' => $behavior,
                    'activities' => $activities,
                    'gpa' => [
                        'total_gpa' => $gpaTotal,
                        'total_credits' => $totalCredits
                    ],
                    'year' => $year,
                    'semester' => $semester
                ]];

            } catch (Exception $e) {
                $response['message'] = 'Database Error: ' . $e->getMessage();
            }
            break;

        // ==========================================
        // 📅 ATTENDANCE
        // ==========================================
       case 'getAttendanceData':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $classId = $params[0]; 
            $date = $params[1];
            
            // 1. ดึงข้อมูลห้องเรียนก่อน (เพื่อเอา level, room)
            $clsStmt = $pdo->prepare("SELECT level, room FROM classes WHERE id = ?");
            $clsStmt->execute([$classId]);
            $classInfo = $clsStmt->fetch();

            if (!$classInfo) {
                $response['message'] = 'ไม่พบข้อมูลห้องเรียน';
                break;
            }

            // 2. ดึงนักเรียนโดยใช้ level และ room (แก้จาก class_id เป็น level/room)
            // ⭐️ แก้ไขตรงนี้: เปลี่ยน WHERE class_id=? เป็น WHERE level=? AND room=?
            $stuStmt = $pdo->prepare("
                SELECT id as student_id, student_code, prefix, firstname, lastname, student_number, photo_url 
                FROM students 
                WHERE level = ? AND room = ? AND status = 'active' 
                ORDER BY student_number ASC
            ");
            $stuStmt->execute([$classInfo['level'], $classInfo['room']]);
            $students = $stuStmt->fetchAll();

            // 3. ดึงข้อมูลการเช็คชื่อ (Attendance) ของวันนี้
            $attStmt = $pdo->prepare("SELECT student_id, status, note FROM attendance WHERE class_id = ? AND date = ?");
            $attStmt->execute([$classId, $date]);
            
            $attendanceMap = [];
            while ($row = $attStmt->fetch()) {
                $attendanceMap[$row['student_id']] = $row;
            }

            // 4. รวมข้อมูล
            $result = [];
            foreach ($students as $s) {
                $s['student_name'] = trim(($s['prefix'] ?? '') . ' ' . $s['firstname'] . ' ' . $s['lastname']);
                
                if (isset($attendanceMap[$s['student_id']])) {
                    $att = $attendanceMap[$s['student_id']];
                    $s['status'] = $att['status'];
                    $s['note'] = $att['note'];
                } else {
                    $s['status'] = 'not_recorded';
                    $s['note'] = '';
                }
                $result[] = $s;
            }

            $response = ['success' => true, 'data' => $result];
            break;
			
		case 'batchSaveAttendance':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            
            $classId = $params[0];
            $date = $params[1];
            $records = $params[2]; // Array ของข้อมูลนักเรียน {student_id, status, note}
            
            // ดึง ID ผู้บันทึก (ถ้ามี)
            $recorder = $_SESSION['user']['id'] ?? 'system';

            try {
                $pdo->beginTransaction();

                foreach($records as $r) {
                    // 1. ตรวจสอบว่ามีข้อมูลของคนนี้ ในวันนี้ หรือยัง?
                    $stmt = $pdo->prepare("SELECT id FROM attendance WHERE student_id = ? AND date = ?");
                    $stmt->execute([$r['student_id'], $date]);
                    $exist = $stmt->fetch();
                    
                    if($exist) {
                        // 2.1 ถ้ามีแล้ว -> UPDATE
                        $sql = "UPDATE attendance SET status = ?, note = ?, recorded_by = ?, updated_at = NOW() WHERE id = ?";
                        $pdo->prepare($sql)->execute([$r['status'], $r['note'], $recorder, $exist['id']]);
                    } else {
                        // 2.2 ถ้ายังไม่มี -> INSERT
                        $id = uuid();
                        $sql = "INSERT INTO attendance (id, student_id, class_id, date, status, note, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?)";
                        $pdo->prepare($sql)->execute([$id, $r['student_id'], $classId, $date, $r['status'], $r['note'], $recorder]);
                    }
                }

                $pdo->commit();
                $response = ['success' => true, 'message' => 'บันทึกข้อมูลสำเร็จ'];

            } catch (Exception $e) {
                $pdo->rollBack();
                $response['message'] = 'Database Error: ' . $e->getMessage();
            }
            break;	
            
        case 'getStudentAttendance':
            // For Student Portal Stats
            $user = validateSession($token);
            $year = $params[0]; $sem = $params[1]; // Logic to filter by date range needed
            
            $sql = "SELECT status, count(*) as count FROM attendance WHERE student_id=? GROUP BY status";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$user['id']]);
            $stats = $stmt->fetchAll(PDO::FETCH_KEY_PAIR); // [present => 50, absent => 2]
            
            $total = array_sum($stats);
            $present = $stats['present'] ?? 0;
            $rate = $total > 0 ? round(($present/$total)*100, 2) : 0;
            
            $data = [
                'total_days' => $total,
                'present_days' => $present,
                'absent_days' => $stats['absent'] ?? 0,
                'late_days' => $stats['late'] ?? 0,
                'leave_days' => $stats['leave'] ?? 0,
                'attendance_rate' => $rate,
                'monthly_stats' => [] // Implement monthly breakdown if needed
            ];
            $response = ['success' => true, 'data' => $data];
            break;

        // ==========================================
        // 🛠️ CONFIG & SYSTEM
        // ==========================================
        case 'getConfig':
            $stmt = $pdo->query("SELECT config_json FROM config LIMIT 1");
            $row = $stmt->fetch();
            $response = ['success' => true, 'data' => json_decode($row['config_json'], true)];
            break;

        case 'updateConfig':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $newConfig = $params[0];
            
            // Handle Logo Upload
            if(isset($newConfig['school_logo_base64']) && $newConfig['school_logo_base64']) {
                $url = uploadBase64($newConfig['school_logo_base64']);
                if($url) {
                    $newConfig['school_logo_url'] = $url;
                }
                unset($newConfig['school_logo_base64']);
            }
            
            // ⭐️ [เพิ่มส่วนนี้] ตรวจสอบว่ามีการเปลี่ยนปีการศึกษาหรือไม่ ⭐️
            // 1. ดึง Config เดิมมาก่อน
            $stmtOld = $pdo->query("SELECT config_json FROM config LIMIT 1");
            $oldRow = $stmtOld->fetch();
            $oldConfig = $oldRow ? json_decode($oldRow['config_json'], true) : [];
            
            $oldYear = $oldConfig['current_year'] ?? '';
            $newYear = $newConfig['current_year'] ?? '';

            // 2. ถ้าปีการศึกษาเปลี่ยน -> อัปเดตห้องเรียนทุกห้องให้เป็นปีใหม่
            if ($oldYear && $newYear && $oldYear !== $newYear) {
                try {
                    $sqlUpdateClasses = "UPDATE classes SET year = ?";
                    $stmtUpdate = $pdo->prepare($sqlUpdateClasses);
                    $stmtUpdate->execute([$newYear]);
                    
                    // (Optional) ถ้าอยากอัปเดตปีของ "นักเรียน" ด้วย (entry_year) ก็ทำได้ที่นี่
                    // $pdo->prepare("UPDATE students SET entry_year = ? WHERE entry_year = ?")->execute([$newYear, $oldYear]);
                    
                } catch (Exception $e) {
                    // Log error (if needed) but don't stop config update
                }
            }
            // ⭐️ [สิ้นสุดส่วนที่เพิ่ม] ⭐️
            
            $json = json_encode($newConfig, JSON_UNESCAPED_UNICODE);
            $pdo->prepare("UPDATE config SET config_json=?, updated_at=NOW() WHERE id=1")->execute([$json]);
            $response = ['success' => true, 'data' => $newConfig];
            break;
			
		// ==========================================
        // 📊 REPORTS & DATA ENTRY (PP5, PP6, BEHAVIOR, ETC.)
        // ==========================================

        // 1. ข้อมูล ปพ.5 / ปพ.6 (getPP5ReportData)
        case 'getPP5ReportData':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $studentId = $params[0];
            $year = $params[1];

            // 1.1 Student & Homeroom
            $stmt = $pdo->prepare("SELECT * FROM students WHERE id = ?");
            $stmt->execute([$studentId]);
            $student = expandJsonColumns($stmt->fetch(), 'data_json');
            
            if (!$student) { $response['message'] = 'Student not found'; break; }

            $stmt = $pdo->prepare("SELECT homeroom_teacher_name FROM classes WHERE level = ? AND room = ? AND year = ?");
            $stmt->execute([$student['level'] ?? '', $student['room'] ?? '', $year]);
            $cls = $stmt->fetch();
            $student['homeroom_teacher_name'] = $cls['homeroom_teacher_name'] ?? '';

            // 1.2 Config
            $stmt = $pdo->query("SELECT config_json FROM config LIMIT 1");
            $config = json_decode($stmt->fetch()['config_json'], true);

            // 1.3 Attendance Summary
            // (คำนวณคร่าวๆ จากข้อมูลที่มี)
            $attData = [
                'sem1' => ['totalDays' => 100, 'present' => 0, 'late' => 0, 'absent' => 0, 'leave' => 0],
                'sem2' => ['totalDays' => 100, 'present' => 0, 'late' => 0, 'absent' => 0, 'leave' => 0],
                'total' => ['totalDays' => 200, 'present' => 0, 'late' => 0, 'absent' => 0, 'leave' => 0]
            ];
            
            $stmt = $pdo->prepare("SELECT date, status FROM attendance WHERE student_id = ?");
            $stmt->execute([$studentId]);
            while ($row = $stmt->fetch()) {
                // แบ่งเทอมตามเดือน (พ.ค.-ต.ค. = 1, พ.ย.-เม.ย. = 2)
                $month = (int)date('m', strtotime($row['date']));
                $sem = ($month >= 5 && $month <= 10) ? 'sem1' : 'sem2';
                
                if (isset($attData[$sem][$row['status']])) {
                    $attData[$sem][$row['status']]++;
                }
            }
            // Update Total
            foreach(['present','late','absent','leave'] as $k) {
                $attData['sem1']['present'] = $attData['sem1']['totalDays'] - $attData['sem1']['late'] - $attData['sem1']['absent'] - $attData['sem1']['leave']; // Approximate
                $attData['sem2']['present'] = $attData['sem2']['totalDays'] - $attData['sem2']['late'] - $attData['sem2']['absent'] - $attData['sem2']['leave']; // Approximate
                
                $attData['total'][$k] = $attData['sem1'][$k] + $attData['sem2'][$k];
            }
            $attData['total']['totalDays'] = $attData['sem1']['totalDays'] + $attData['sem2']['totalDays'];

            // 1.4 Scores & GPA
            $scores = ['sem1' => [], 'sem2' => [], 'year' => []];
            $stmt = $pdo->prepare("SELECT sc.*, s.subject_code, s.subject_name, s.credit FROM scores sc JOIN subjects s ON sc.subject_id = s.id WHERE sc.student_id = ? AND sc.year = ?");
            $stmt->execute([$studentId, $year]);
            $rawScores = $stmt->fetchAll();

            foreach($rawScores as $rs) {
                $item = [
                    'subject_code' => $rs['subject_code'],
                    'subject_name' => $rs['subject_name'],
                    'credit' => $rs['credit'],
                    'total_score' => $rs['total_score'],
                    'grade' => $rs['grade'],
                    'gpa_value' => $rs['gpa_value']
                ];
                if ($rs['semester'] == '1') $scores['sem1'][] = $item;
                if ($rs['semester'] == '2') $scores['sem2'][] = $item;
            }

            // คำนวณ GPA เฉลี่ยรายปี
            $subjMap = [];
            foreach(array_merge($scores['sem1'], $scores['sem2']) as $s) $subjMap[$s['subject_code']][] = $s;
            
            foreach($subjMap as $code => $list) {
                $sumScore = 0; $count = 0; $credit = 0; $name = '';
                foreach($list as $i) { $sumScore += $i['total_score']; $count++; $credit = $i['credit']; $name = $i['subject_name']; }
                $avg = $count > 0 ? round($sumScore/$count) : 0;
                // Grade Calc
                $g = '0'; $gv = 0;
                if($avg>=80){$g='4';$gv=4;} elseif($avg>=75){$g='3.5';$gv=3.5;} elseif($avg>=70){$g='3';$gv=3;}
                elseif($avg>=65){$g='2.5';$gv=2.5;} elseif($avg>=60){$g='2';$gv=2;} elseif($avg>=55){$g='1.5';$gv=1.5;}
                elseif($avg>=50){$g='1';$gv=1;}
                
                $scores['year'][] = ['subject_code'=>$code, 'subject_name'=>$name, 'credit'=>$credit, 'total_score'=>$avg, 'grade'=>$g, 'gpa_value'=>$gv];
            }

            // GPA Helper
            $calcGPA = function($list) {
                $pts = 0; $creds = 0;
                foreach($list as $i) { $pts += ($i['gpa_value'] * $i['credit']); $creds += $i['credit']; }
                return ['total_gpa' => $creds>0 ? number_format($pts/$creds, 2) : '0.00', 'total_credits' => $creds];
            };
            $gpa = ['sem1' => $calcGPA($scores['sem1']), 'sem2' => $calcGPA($scores['sem2']), 'year' => $calcGPA($scores['year'])];

            // 1.5 Behaviors
            $behaviors = ['sem1' => null, 'sem2' => null];
            $stmt = $pdo->prepare("SELECT * FROM behaviors WHERE student_id = ? AND year = ?");
            $stmt->execute([$studentId, $year]);
            while($row = $stmt->fetch()) {
                $traits = json_decode($row['traits_json'], true) ?? [];
                $row['traits'] = $traits; // JS expects row.traits
                if ($row['semester'] == '1') $behaviors['sem1'] = $row;
                if ($row['semester'] == '2') $behaviors['sem2'] = $row;
            }

            // 1.6 Activities
            $activities = ['sem1' => null, 'sem2' => null];
            $stmt = $pdo->prepare("SELECT * FROM activities WHERE student_id = ? AND year = ?");
            $stmt->execute([$studentId, $year]);
            while($row = $stmt->fetch()) {
                $row['guidance'] = json_decode($row['guidance'], true);
                $row['club'] = json_decode($row['club'], true);
                $row['social_service'] = json_decode($row['social_service'], true);
                $row['scout'] = json_decode($row['scout'], true);
                if ($row['semester'] == '1') $activities['sem1'] = $row;
                if ($row['semester'] == '2') $activities['sem2'] = $row;
            }

            // 1.7 Reading
            $readings = ['sem1' => null, 'sem2' => null];
            $stmt = $pdo->prepare("SELECT * FROM readings WHERE student_id = ? AND year = ?");
            $stmt->execute([$studentId, $year]);
            while($row = $stmt->fetch()) {
                if ($row['semester'] == '1') $readings['sem1'] = $row;
                if ($row['semester'] == '2') $readings['sem2'] = $row;
            }

            $response = ['success' => true, 'data' => [
                'student' => $student, 'config' => $config, 'attendance' => $attData,
                'scores' => $scores, 'behavior' => $behaviors, 'activities' => $activities,
                'gpa' => $gpa, 'readings' => $readings
            ]];
            break;

        // 2. BEHAVIOR DATA (Get & Save)
        case 'getBehaviorData':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $classId = $params[0]; $sem = $params[1]; $year = $params[2];
            
            // Get Students
            $c = $pdo->prepare("SELECT level, room FROM classes WHERE id=?"); $c->execute([$classId]); $cls = $c->fetch();
            $stmt = $pdo->prepare("SELECT id as student_id, student_code, prefix, firstname, lastname, student_number FROM students WHERE level=? AND room=? AND status='active' ORDER BY student_number");
            $stmt->execute([$cls['level'], $cls['room']]);
            $students = $stmt->fetchAll();

            // Get Behaviors
            $bStmt = $pdo->prepare("SELECT * FROM behaviors WHERE class_id=? AND year=? AND semester=?");
            $bStmt->execute([$classId, $year, $sem]);
            $behs = [];
            foreach($bStmt->fetchAll() as $b) $behs[$b['student_id']] = $b;

            $result = [];
            foreach($students as $s) {
                $s['student_name'] = trim($s['prefix'].$s['firstname'].' '.$s['lastname']);
                if(isset($behs[$s['student_id']])) {
                    $b = $behs[$s['student_id']];
                    $b['traits'] = json_decode($b['traits_json'], true);
                    $s = array_merge($s, $b);
                    $s['behavior_id'] = $b['id']; // JS expects behavior_id
                } else {
                    $s['behavior_id'] = null;
                    $s['conduct_score'] = 100;
                    $s['traits'] = [];
                    $s['overall_behavior'] = 'ดีเยี่ยม';
                }
                $result[] = $s;
            }
            $response = ['success' => true, 'data' => $result];
            break;

        case 'saveOrUpdateBehavior':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $d = $params[0];
            $traits = json_encode($d['traits'], JSON_UNESCAPED_UNICODE);
            
            if ($d['id']) {
                $sql = "UPDATE behaviors SET conduct_score=?, overall_behavior=?, traits_json=?, positive_note=?, improvement_note=?, updated_at=NOW() WHERE id=?";
                $pdo->prepare($sql)->execute([$d['conduct_score'], $d['overall_behavior'], $traits, $d['positive_note']??'', $d['improvement_note']??'', $d['id']]);
                $d['traits'] = $d['traits']; // Return as object
            } else {
                $d['id'] = uuid();
                $sql = "INSERT INTO behaviors (id, student_id, class_id, year, semester, conduct_score, overall_behavior, traits_json, positive_note, improvement_note) VALUES (?,?,?,?,?,?,?,?,?,?)";
                $pdo->prepare($sql)->execute([$d['id'], $d['student_id'], $d['class_id'], $d['year'], $d['semester'], $d['conduct_score'], $d['overall_behavior'], $traits, $d['positive_note']??'', $d['improvement_note']??'']);
            }
            $response = ['success' => true, 'data' => $d];
            break;

        // 3. ACTIVITY DATA (Get & Save)
        case 'getActivityData':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $classId = $params[0]; $sem = $params[1]; $year = $params[2];
            
            // Get Students (Same as Behavior)
            $c = $pdo->prepare("SELECT level, room FROM classes WHERE id=?"); $c->execute([$classId]); $cls = $c->fetch();
            $stmt = $pdo->prepare("SELECT id as student_id, student_code, prefix, firstname, lastname, student_number FROM students WHERE level=? AND room=? AND status='active' ORDER BY student_number");
            $stmt->execute([$cls['level'], $cls['room']]);
            $students = $stmt->fetchAll();

            // Get Activities
            $aStmt = $pdo->prepare("SELECT * FROM activities WHERE class_id=? AND year=? AND semester=?");
            $aStmt->execute([$classId, $year, $sem]);
            $acts = [];
            foreach($aStmt->fetchAll() as $a) $acts[$a['student_id']] = $a;

            $result = [];
            foreach($students as $s) {
                $s['student_name'] = trim($s['prefix'].$s['firstname'].' '.$s['lastname']);
                if(isset($acts[$s['student_id']])) {
                    $a = $acts[$s['student_id']];
                    $a['guidance'] = json_decode($a['guidance'], true);
                    $a['club'] = json_decode($a['club'], true);
                    $a['social_service'] = json_decode($a['social_service'], true);
                    $a['scout'] = json_decode($a['scout'], true);
                    $s = array_merge($s, $a);
                    $s['activity_id'] = $a['id'];
                } else {
                    $s['activity_id'] = null;
                    $def = ['status'=>'ผ่าน', 'note'=>''];
                    $s['guidance'] = $def; $s['club'] = $def; $s['social_service'] = $def; $s['scout'] = $def;
                }
                $result[] = $s;
            }
            $response = ['success' => true, 'data' => $result];
            break;

        case 'saveOrUpdateActivity':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $d = $params[0];
            $g = json_encode($d['guidance'], JSON_UNESCAPED_UNICODE);
            $c = json_encode($d['club'], JSON_UNESCAPED_UNICODE);
            $s = json_encode($d['social_service'], JSON_UNESCAPED_UNICODE);
            $sc = json_encode($d['scout'], JSON_UNESCAPED_UNICODE);
            
            if ($d['id']) {
                $sql = "UPDATE activities SET guidance=?, club=?, social_service=?, scout=?, updated_at=NOW() WHERE id=?";
                $pdo->prepare($sql)->execute([$g, $c, $s, $sc, $d['id']]);
            } else {
                $d['id'] = uuid();
                $sql = "INSERT INTO activities (id, student_id, class_id, year, semester, guidance, club, social_service, scout) VALUES (?,?,?,?,?,?,?,?,?)";
                $pdo->prepare($sql)->execute([$d['id'], $d['student_id'], $d['class_id'], $d['year'], $d['semester'], $g, $c, $s, $sc]);
            }
            $response = ['success' => true, 'data' => $d];
            break;

        // 4. READING DATA
        case 'getReadingData':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $classId = $params[0]; $sem = $params[1]; $year = $params[2];
            
            $c = $pdo->prepare("SELECT level, room FROM classes WHERE id=?"); $c->execute([$classId]); $cls = $c->fetch();
            $stmt = $pdo->prepare("SELECT id as student_id, student_code, prefix, firstname, lastname, student_number FROM students WHERE level=? AND room=? AND status='active' ORDER BY student_number");
            $stmt->execute([$cls['level'], $cls['room']]);
            $students = $stmt->fetchAll();

            $rStmt = $pdo->prepare("SELECT * FROM readings WHERE class_id=? AND year=? AND semester=?");
            $rStmt->execute([$classId, $year, $sem]);
            $reads = [];
            foreach($rStmt->fetchAll() as $r) $reads[$r['student_id']] = $r;

            $result = [];
            foreach($students as $s) {
                $s['student_name'] = trim($s['prefix'].$s['firstname'].' '.$s['lastname']);
                if(isset($reads[$s['student_id']])) {
                    $r = $reads[$s['student_id']];
                    $s['reading_id'] = $r['id'];
                    $s['status'] = $r['status'];
                    $s['note'] = $r['note'];
                } else {
                    $s['reading_id'] = null;
                    $s['status'] = 'ดีเยี่ยม';
                    $s['note'] = '';
                }
                $result[] = $s;
            }
            $response = ['success' => true, 'data' => $result];
            break;

        case 'saveOrUpdateReading':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $d = $params[0];
            if ($d['id']) {
                $pdo->prepare("UPDATE readings SET status=?, note=?, updated_at=NOW() WHERE id=?")->execute([$d['status'], $d['note'], $d['id']]);
            } else {
                $d['id'] = uuid();
                $pdo->prepare("INSERT INTO readings (id, student_id, class_id, year, semester, status, note) VALUES (?,?,?,?,?,?,?)")->execute([$d['id'], $d['student_id'], $d['class_id'], $d['year'], $d['semester'], $d['status'], $d['note']]);
            }
            $response = ['success' => true, 'data' => $d];
            break;

        // 5. REPORT HELPERS
        case 'getStudentListReportData':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $f = $params[0]; // filters { classId, status }
            
            $sql = "SELECT * FROM students WHERE 1=1";
            $args = [];
            
            if (!empty($f['classId'])) {
                $c = $pdo->prepare("SELECT level, room FROM classes WHERE id=?");
                $c->execute([$f['classId']]);
                if ($cls = $c->fetch()) {
                    $sql .= " AND level = ? AND room = ?";
                    array_push($args, $cls['level'], $cls['room']);
                }
            }
            if (!empty($f['status'])) {
                $sql .= " AND status = ?";
                $args[] = $f['status'];
            } else {
                $sql .= " AND status != 'deleted'";
            }
            $sql .= " ORDER BY level, room, student_number";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute($args);
            $response = ['success' => true, 'data' => $stmt->fetchAll()];
            break;
			
		case 'getGradeSummaryReportData':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $f = $params[0]; // filters: { classId, year, semester }

            try {
                // 1. สร้าง Query ดึงนักเรียน (กรองตามห้องถ้ามี)
                $sql = "SELECT id, prefix, firstname, lastname, student_number FROM students WHERE status = 'active'";
                $args = [];

                if (!empty($f['classId'])) {
                    $cStmt = $pdo->prepare("SELECT level, room FROM classes WHERE id = ?");
                    $cStmt->execute([$f['classId']]);
                    $cls = $cStmt->fetch();
                    if ($cls) {
                        $sql .= " AND level = ? AND room = ?";
                        array_push($args, $cls['level'], $cls['room']);
                    }
                }
                // เรียงตามเลขที่
                $sql .= " ORDER BY student_number ASC";
                
                $stmt = $pdo->prepare($sql);
                $stmt->execute($args);
                $students = $stmt->fetchAll();

                $reportData = [];

                // 2. วนลูปนักเรียนเพื่อคำนวณ GPA
                foreach ($students as $stu) {
                    // ดึงคะแนน + หน่วยกิต (JOIN subjects)
                    $scoreSql = "SELECT sc.gpa_value, s.credit 
                                 FROM scores sc 
                                 JOIN subjects s ON sc.subject_id = s.id 
                                 WHERE sc.student_id = ? AND sc.year = ?";
                    $scoreArgs = [$stu['id'], $f['year']];

                    // ถ้าไม่ได้เลือก 'all' ให้กรองเทอมด้วย
                    if ($f['semester'] !== 'all') {
                        $scoreSql .= " AND sc.semester = ?";
                        $scoreArgs[] = $f['semester'];
                    }

                    $scStmt = $pdo->prepare($scoreSql);
                    $scStmt->execute($scoreArgs);
                    $scores = $scStmt->fetchAll();

                    $totalPoints = 0;
                    $totalCredits = 0;

                    foreach ($scores as $s) {
                        $credit = floatval($s['credit']);
                        $gpa = floatval($s['gpa_value']);
                        
                        // คำนวณเฉพาะวิชาที่มีหน่วยกิต
                        if ($credit > 0) {
                            $totalPoints += ($gpa * $credit);
                            $totalCredits += $credit;
                        }
                    }

                    $gpaTotal = $totalCredits > 0 ? number_format($totalPoints / $totalCredits, 2) : '0.00';

                    $reportData[] = [
                        'student_number' => $stu['student_number'] ?? '-',
                        'full_name' => trim(($stu['prefix'] ?? '') . ' ' . $stu['firstname'] . ' ' . $stu['lastname']),
                        'total_credits' => $totalCredits,
                        'total_gpa' => $gpaTotal
                    ];
                }

                $response = ['success' => true, 'data' => $reportData];

            } catch (Exception $e) {
                $response['message'] = 'Database Error: ' . $e->getMessage();
            }
            break;	

       case 'getAttendanceReportData':
            if (!validateSession($token)) { $response['message'] = 'Unauthorized'; break; }
            $f = $params[0]; // { classId, year, semester }
            
            try {
                // 1. ดึงรายชื่อนักเรียนในห้องที่เลือก (Active)
                $sqlStu = "SELECT id, student_code, prefix, firstname, lastname, student_number FROM students WHERE status = 'active'";
                $argsStu = [];
                
                if (!empty($f['classId'])) {
                    // ดึง level/room ของห้องนั้นก่อน
                    $cStmt = $pdo->prepare("SELECT level, room FROM classes WHERE id = ?");
                    $cStmt->execute([$f['classId']]);
                    $cls = $cStmt->fetch();
                    
                    if ($cls) {
                        $sqlStu .= " AND level = ? AND room = ?";
                        array_push($argsStu, $cls['level'], $cls['room']);
                    }
                }
                
                $sqlStu .= " ORDER BY student_number ASC";
                
                $stmt = $pdo->prepare($sqlStu);
                $stmt->execute($argsStu);
                $students = $stmt->fetchAll();
                
                $reportData = [];
                
                // 2. วนลูปนักเรียนเพื่อดึงสถิติการมาเรียน
                foreach ($students as $s) {
                    // สร้าง Template ข้อมูล
                    $stat = [
                        'student_number' => $s['student_number'] ?? '-',
                        'student_name' => trim(($s['prefix'] ?? '') . ' ' . $s['firstname'] . ' ' . $s['lastname']),
                        'present' => 0,
                        'late' => 0,
                        'absent' => 0,
                        'leave' => 0,
                        'total' => 0
                    ];
                    
                    // Query ดึงข้อมูลการเช็คชื่อ
                    // (ต้องกรองวันที่ให้อยู่ในช่วงเทอม/ปีการศึกษาด้วย)
                    // แต่เพื่อความง่าย เราจะดึงทั้งหมดของนักเรียนคนนี้ แล้วมานับด้วย PHP (หรือจะใช้ GROUP BY ก็ได้)
                    
                    // สมมติว่าเรากรองแค่นักเรียนคนนี้ก่อน (ในระบบจริงควร filter by date range ของเทอมนั้นๆ)
                    $attSql = "SELECT status, date FROM attendance WHERE student_id = ?";
                    $attStmt = $pdo->prepare($attSql);
                    $attStmt->execute([$s['id']]);
                    $records = $attStmt->fetchAll();
                    
                    foreach ($records as $r) {
                        // แปลงวันที่เป็นปี/เทอม เพื่อกรอง
                        $date = strtotime($r['date']);
                        $month = (int)date('m', $date);
                        $yearCE = (int)date('Y', $date);
                        
                        // คำนวณปีการศึกษาไทย
                        $eduYear = $yearCE + 543;
                        $semester = '1';
                        
                        if ($month <= 4) { // ม.ค.-เม.ย. เป็นเทอม 2 ของปีก่อนหน้า
                            $eduYear -= 1;
                            $semester = '2';
                        } elseif ($month >= 11) { // พ.ย.-ธ.ค. เป็นเทอม 2
                            $semester = '2';
                        } else { // พ.ค.-ต.ค. เป็นเทอม 1
                            $semester = '1';
                        }
                        
                        // ตรวจสอบเงื่อนไข Filter
                        if ($f['year'] && (string)$eduYear !== (string)$f['year']) continue;
                        if ($f['semester'] && $f['semester'] !== 'all' && $semester !== $f['semester']) continue;
                        
                        // นับสถิติ
                        if (isset($stat[$r['status']])) {
                            $stat[$r['status']]++;
                        }
                        // นับรวมวันที่บันทึก
                        if ($r['status'] !== 'not_recorded') {
                            $stat['total']++;
                        }
                    }
                    
                    $reportData[] = $stat;
                }
                
                $response = ['success' => true, 'data' => $reportData];

            } catch (Exception $e) {
                $response['message'] = 'Database Error: ' . $e->getMessage();
            }
            break;
    }

} catch (Exception $e) {
    $response['message'] = "Server Error: " . $e->getMessage();
}

// 2. ล้าง Buffer ก่อนส่งออก เพื่อให้แน่ใจว่าเป็น JSON เพียวๆ
ob_clean();
echo json_encode($response);
exit;
?>