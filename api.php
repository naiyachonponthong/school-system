<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

$action = $_GET['action'] ?? '';
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?? [];

$response = ['success' => false, 'message' => 'Unknown action'];

// Helper: บันทึกรูปภาพ
function saveImage($base64Data, $prefix = 'img') {
    if (empty($base64Data) || strpos($base64Data, 'base64,') === false) return $base64Data;
    $parts = explode(',', $base64Data);
    $ext = (strpos($parts[0], 'png') !== false) ? 'png' : 'jpg';
    $decoded = base64_decode($parts[1]);
    if ($decoded === false) return null;
    if (!is_dir('uploads')) mkdir('uploads', 0777, true);
    $filename = $prefix . '_' . time() . '_' . uniqid() . '.' . $ext;
    file_put_contents('uploads/' . $filename, $decoded);
    return 'uploads/' . $filename;
}

// Helper: แปลง JSON Field ใน Database (สำหรับตารางอื่นที่ยังใช้ JSON)
function decodeJsonField(&$item, $field) {
    if (isset($item[$field])) {
        $item[$field] = json_decode($item[$field], true) ?? [];
    }
}

try {
    switch ($action) {
        // ============================================================
        // 1. AUTH
        // ============================================================
        case 'login':
            $username = $input['username'];
            $password = $input['password'];
            $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? AND password = SHA2(?, 256)");
            $stmt->execute([$username, $password]);
            $user = $stmt->fetch();
            if ($user && $user['active']) {
                $_SESSION['user'] = $user;
                unset($_SESSION['user']['password']);
                $pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?")->execute([$user['id']]);
                $response = ['success' => true, 'sessionToken' => session_id(), 'user' => $_SESSION['user']];
            } else {
                $response['message'] = 'Username หรือ Password ไม่ถูกต้อง';
            }
            break;

        case 'loginStudent':
            $stmt = $pdo->prepare("SELECT * FROM students WHERE student_code = ? AND id_card = ? AND status = 'active'");
            $stmt->execute([$input['studentId'], $input['idCard']]);
            $student = $stmt->fetch();
            if ($student) {
                $_SESSION['user'] = [
                    'id' => $student['id'], 'user_id' => $student['id'], 'username' => $student['student_code'],
                    'role' => 'student', 'name' => trim($student['prefix'] . ' ' . $student['firstname'] . ' ' . $student['lastname']),
                    'photo_url' => $student['photo_url'], 'class_id' => $student['class_id']
                ];
                $response = ['success' => true, 'sessionToken' => session_id(), 'user' => $_SESSION['user']];
            } else {
                $response['message'] = 'ข้อมูลไม่ถูกต้อง';
            }
            break;
        
        case 'validateSession':
            if (isset($_SESSION['user'])) $response = ['success' => true, 'user' => $_SESSION['user']];
            else $response['message'] = 'Session หมดอายุ';
            break;

        case 'logout': session_destroy(); $response = ['success' => true]; break;
        case 'getActiveUserCount': $response = ['success' => true, 'data' => 1]; break;

        // ============================================================
        // 2. STUDENT MANAGEMENT (ปรับใหม่: ใช้คอลัมน์จริง)
        // ============================================================
        case 'getStudents':
            $stmt = $pdo->query("SELECT * FROM students WHERE status != 'deleted' ORDER BY student_number ASC");
            $students = $stmt->fetchAll();
            
            // แปลงข้อมูลที่อยู่กลับเป็น Object เพื่อให้ JS เดิมทำงานได้
            foreach ($students as &$s) {
                $s['address'] = [
                    'address' => $s['address_no'],
                    'subdistrict' => $s['subdistrict'],
                    'district' => $s['district'],
                    'province' => $s['province'],
                    'zipcode' => $s['zipcode']
                ];
            }
            $response = ['success' => true, 'data' => $students];
            break;

        case 'createStudent':
            $d = $input;
            $id = uuid();
            
            // จัดการรูปภาพ
            $photoUrl = '';
            if (!empty($d['photo_base64'])) {
                $photoUrl = saveImage($d['photo_base64'], 'std_' . $d['student_code']);
            }

            // ดึงข้อมูลที่อยู่จาก Object address ที่ JS ส่งมา
            $addr = $d['address'] ?? [];

            $sql = "INSERT INTO students (
                id, student_code, id_card, prefix, firstname, lastname, nickname, birthdate, gender, blood_type, 
                ethnicity, nationality, religion, level, room, student_number, class_id, 
                entry_year, status, photo_url, phone, email,
                address_no, subdistrict, district, province, zipcode,
                father_name, father_occupation, father_phone, mother_name, mother_occupation, mother_phone, parent_marital_status,
                guardian_name, guardian_relation, guardian_occupation, guardian_phone, created_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
                ?, ?, ?, ?, ?, ?, ?, 
                ?, ?, ?, ?, ?, 
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, NOW()
            )";

            $pdo->prepare($sql)->execute([
                $id, $d['student_code'], $d['id_card'], $d['prefix'], $d['firstname'], $d['lastname'], $d['nickname']??'', $d['birthdate'], $d['gender']??'', $d['blood_type']??'',
                $d['ethnicity']??'', $d['nationality']??'', $d['religion']??'', $d['level'], $d['room'], $d['student_number'], $d['class_id']??'',
                $d['entry_year']??'', 'active', $photoUrl, $d['phone']??'', $d['email']??'',
                $addr['address']??'', $addr['subdistrict']??'', $addr['district']??'', $addr['province']??'', $addr['zipcode']??'',
                $d['father_name']??'', $d['father_occupation']??'', $d['father_phone']??'', $d['mother_name']??'', $d['mother_occupation']??'', $d['mother_phone']??'', $d['parent_marital_status']??'',
                $d['guardian_name']??'', $d['guardian_relation']??'', $d['guardian_occupation']??'', $d['guardian_phone']??''
            ]);
            $response = ['success' => true, 'message' => 'เพิ่มนักเรียนสำเร็จ'];
            break;

        case 'updateStudent':
            $id = $input['id'];
            $d = $input;
            unset($d['id']);

            // จัดการรูปภาพ
            if (!empty($d['photo_base64'])) {
                $url = saveImage($d['photo_base64'], 'std_' . ($d['student_code'] ?? 'update'));
                if ($url) $d['photo_url'] = $url;
            }
            unset($d['photo_base64']);

            // จัดการที่อยู่ (Flatten address object to columns)
            if (isset($d['address']) && is_array($d['address'])) {
                $d['address_no'] = $d['address']['address'] ?? '';
                $d['subdistrict'] = $d['address']['subdistrict'] ?? '';
                $d['district'] = $d['address']['district'] ?? '';
                $d['province'] = $d['address']['province'] ?? '';
                $d['zipcode'] = $d['address']['zipcode'] ?? '';
                unset($d['address']);
            }
            
            // สร้าง SQL Update Dynamic
            $fields = []; $params = [];
            // รายชื่อฟิลด์ที่มีในฐานข้อมูลจริง
            $allowedCols = [
                'student_code', 'id_card', 'prefix', 'firstname', 'lastname', 'nickname', 'birthdate', 'gender', 'blood_type',
                'ethnicity', 'nationality', 'religion', 'level', 'room', 'student_number', 'class_id', 'entry_year', 'entry_date', 'graduation_date', 'status', 'photo_url',
                'phone', 'email', 'address_no', 'subdistrict', 'district', 'province', 'zipcode',
                'father_name', 'father_occupation', 'father_phone', 'mother_name', 'mother_occupation', 'mother_phone', 'parent_marital_status',
                'guardian_name', 'guardian_relation', 'guardian_occupation', 'guardian_phone'
            ];

            foreach ($d as $k => $v) {
                if (in_array($k, $allowedCols)) {
                    $fields[] = "$k = ?";
                    $params[] = $v;
                }
            }
            $params[] = $id;

            if (!empty($fields)) {
                $pdo->prepare("UPDATE students SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
            }
            
            // Return Updated Data
            $stmt = $pdo->prepare("SELECT * FROM students WHERE id = ?");
            $stmt->execute([$id]);
            $updated = $stmt->fetch();
            // Re-structure address for JS
            $updated['address'] = [
                'address' => $updated['address_no'],
                'subdistrict' => $updated['subdistrict'],
                'district' => $updated['district'],
                'province' => $updated['province'],
                'zipcode' => $updated['zipcode']
            ];
            $response = ['success' => true, 'data' => $updated];
            break;

        case 'deleteStudent':
            $pdo->prepare("UPDATE students SET status = 'deleted' WHERE id = ?")->execute([$input['id']]);
            $response = ['success' => true];
            break;

        case 'batchCreateStudents':
            $students = $input;
            $pdo->beginTransaction();
            try {
                $sql = "INSERT INTO students (id, student_code, id_card, prefix, firstname, lastname, level, room, student_number, status, ethnicity, nationality, religion, phone, address_no, subdistrict, district, province, zipcode, father_name, father_phone, mother_name, mother_phone, parent_marital_status, guardian_name, guardian_phone, created_at) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
                $stmt = $pdo->prepare($sql);
                $count = 0;
                foreach ($students as $d) {
                    $addr = $d['address'] ?? [];
                    $stmt->execute([
                        uuid(), $d['student_code'], $d['id_card'], $d['prefix'], $d['firstname'], $d['lastname'],
                        $d['level'], $d['room'], $d['student_number'],
                        $d['ethnicity']??'', $d['nationality']??'', $d['religion']??'', $d['phone']??'',
                        $addr['address']??'', $addr['subdistrict']??'', $addr['district']??'', $addr['province']??'', $addr['zipcode']??'',
                        $d['father_name']??'', $d['father_phone']??'', $d['mother_name']??'', $d['mother_phone']??'',
                        $d['parent_marital_status']??'', $d['guardian_name']??'', $d['guardian_phone']??''
                    ]);
                    $count++;
                }
                $pdo->commit();
                $response = ['success' => true, 'summary' => ['added' => $count, 'failed' => 0, 'errors' => []]];
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            break;

        case 'batchMoveStudents':
            $ids = $input['studentIds'];
            $targetId = $input['targetClassId'];
            $target = $pdo->query("SELECT level, room FROM classes WHERE id = '$targetId'")->fetch();
            if ($target) {
                $placeholders = str_repeat('?,', count($ids) - 1) . '?';
                $params = array_merge([$target['level'], $target['room'], $targetId], $ids);
                $pdo->prepare("UPDATE students SET level=?, room=?, class_id=? WHERE id IN ($placeholders)")->execute($params);
                $response = ['success' => true, 'message' => 'ย้ายนักเรียนสำเร็จ'];
            }
            break;

        // ============================================================
        // 3. USERS (Admins/Teachers)
        // ============================================================
        case 'getUsers':
            if (($_SESSION['user']['role'] ?? '') !== 'admin') throw new Exception("Access Denied");
            $stmt = $pdo->query("SELECT id, username, role, name, email, phone, photo_url, active, last_login FROM users ORDER BY created_at DESC");
            $response = ['success' => true, 'data' => $stmt->fetchAll()];
            break;
        case 'getTeachers':
            $stmt = $pdo->query("SELECT id, name, role FROM users WHERE role IN ('teacher', 'homeroom', 'admin', 'principal') AND active = 1 ORDER BY name ASC");
            $response = ['success' => true, 'data' => $stmt->fetchAll()];
            break;
        case 'createUser':
            $d = $input; $id = uuid();
            $pdo->prepare("INSERT INTO users (id, username, password, role, name, email, phone, active, created_at) VALUES (?, ?, SHA2(?, 256), ?, ?, ?, ?, 1, NOW())")
                ->execute([$id, $d['username'], $d['password'], $d['role'], $d['name'], $d['email'], $d['phone']]);
            $response = ['success' => true, 'message' => 'สร้างผู้ใช้สำเร็จ'];
            break;
        case 'updateUser':
            $id = $input['id']; $d = $input; unset($d['id'], $d['password']);
            if(!empty($d['photo_base64'])) { $d['photo_url'] = saveImage($d['photo_base64'], 'usr_'.$d['username']); } unset($d['photo_base64']);
            $f=[]; $p=[]; foreach($d as $k=>$v){ $f[]="$k=?"; $p[]=$v; } $p[]=$id;
            $pdo->prepare("UPDATE users SET ".implode(',',$f)." WHERE id=?")->execute($p);
            $updated = $pdo->query("SELECT id, username, role, name, photo_url FROM users WHERE id='$id'")->fetch();
            if($_SESSION['user']['id']===$id) $_SESSION['user']=array_merge($_SESSION['user'], $updated);
            $response = ['success' => true, 'data' => $updated];
            break;
        case 'deleteUser':
            $pdo->prepare("DELETE FROM users WHERE id=?")->execute([$input['id']]);
            $response = ['success' => true];
            break;
        case 'changePassword':
            $uid=$_SESSION['user']['id'];
            if($pdo->query("SELECT id FROM users WHERE id='$uid' AND password=SHA2('{$input['oldPassword']}',256)")->fetch()) {
                $pdo->prepare("UPDATE users SET password=SHA2(?,256) WHERE id=?")->execute([$input['newPassword'], $uid]);
                $response=['success'=>true];
            } else $response['message']='รหัสผ่านเดิมผิด';
            break;
        case 'getProfileData':
            $uid=$_SESSION['user']['id'];
            $usr=$pdo->query("SELECT id, username, role, name, email, phone, photo_url, last_login FROM users WHERE id='$uid'")->fetch();
            $subj=$pdo->query("SELECT * FROM subjects WHERE teacher_id='$uid' AND status='active'")->fetchAll();
            $cls=$pdo->query("SELECT * FROM classes WHERE homeroom_teacher_id='$uid' AND status='active'")->fetchAll();
            $response=['success'=>true, 'data'=>['user'=>$usr, 'subjects'=>$subj, 'homeroom'=>$cls]];
            break;

        // ============================================================
        // 4. CLASS & SUBJECT
        // ============================================================
        case 'getClasses':
            $response = ['success'=>true, 'data'=>$pdo->query("SELECT * FROM classes WHERE status='active' ORDER BY level, room")->fetchAll()];
            break;
        case 'createClass':
            $d=$input; $id=uuid();
            $pdo->prepare("INSERT INTO classes (id, level, room, year, homeroom_teacher_id, homeroom_teacher_name, capacity, created_at) VALUES (?,?,?,?,?,?,?,NOW())")
                ->execute([$id, $d['level'], $d['room'], $d['year'], $d['homeroom_teacher_id'], $d['homeroom_teacher_name'], $d['capacity']]);
            $response=['success'=>true];
            break;
        case 'updateClass':
            $id=$input['id']; $d=$input; unset($d['id']); $f=[]; $p=[]; foreach($d as $k=>$v){$f[]="$k=?"; $p[]=$v;} $p[]=$id;
            $pdo->prepare("UPDATE classes SET ".implode(',',$f)." WHERE id=?")->execute($p);
            $response=['success'=>true];
            break;
        case 'deleteClass':
            $pdo->prepare("UPDATE classes SET status='deleted' WHERE id=?")->execute([$input['id']]);
            $response=['success'=>true];
            break;
            
        case 'getSubjects':
            $subs = $pdo->query("SELECT * FROM subjects WHERE status='active' ORDER BY subject_code")->fetchAll();
            foreach($subs as &$s) decodeJsonField($s, 'indicators');
            $response = ['success'=>true, 'data'=>$subs];
            break;
        case 'createSubject':
            $d=$input; $id=uuid();
            $pdo->prepare("INSERT INTO subjects (id,subject_code,subject_name,subject_group,credit,level,created_at) VALUES (?,?,?,?,?,?,NOW())")
                ->execute([$id,$d['subject_code'],$d['subject_name'],$d['subject_group'],$d['credit'],$d['level']]);
            $response=['success'=>true];
            break;
        case 'updateSubject':
            $id=$input['id']; $d=$input; unset($d['id']);
            $f=[]; $p=[]; foreach($d as $k=>$v){ if($k=='indicators')$v=json_encode($v, JSON_UNESCAPED_UNICODE); $f[]="$k=?"; $p[]=$v; } $p[]=$id;
            $pdo->prepare("UPDATE subjects SET ".implode(',',$f)." WHERE id=?")->execute($p);
            $response=['success'=>true];
            break;
        case 'deleteSubject':
            $pdo->prepare("UPDATE subjects SET status='deleted' WHERE id=?")->execute([$input['id']]);
            $response=['success'=>true];
            break;
        case 'batchUpdateTeacherAssignments':
            $tid=$input['teacherId']; $tname=$input['teacherName']; $sids=$input['subjectIds'];
            $pdo->prepare("UPDATE subjects SET teacher_id='', teacher_name='' WHERE teacher_id=?")->execute([$tid]);
            if(!empty($sids)) {
                $holder=str_repeat('?,',count($sids)-1).'?';
                $pdo->prepare("UPDATE subjects SET teacher_id=?, teacher_name=? WHERE id IN ($holder)")->execute(array_merge([$tid,$tname],$sids));
            }
            $response=['success'=>true];
            break;
        
        // ============================================================
        // 5. INDICATORS
        // ============================================================
        case 'addIndicatorToSubject':
            $sid=$input['subjectId']; $name=$input['name']; $max=$input['max'];
            $inds = json_decode($pdo->query("SELECT indicators FROM subjects WHERE id='$sid'")->fetchColumn(), true) ?? [];
            $inds[] = ['id'=>uniqid(), 'name'=>$name, 'max'=>$max];
            $pdo->prepare("UPDATE subjects SET indicators=? WHERE id=?")->execute([json_encode($inds, JSON_UNESCAPED_UNICODE), $sid]);
            $response=['success'=>true];
            break;
        case 'updateIndicatorInSubject':
            $sid=$input['subjectId']; $iid=$input['indicatorId'];
            $inds = json_decode($pdo->query("SELECT indicators FROM subjects WHERE id='$sid'")->fetchColumn(), true) ?? [];
            foreach($inds as &$i) { if($i['id']==$iid) { $i['name']=$input['name']; $i['max']=$input['max']; } }
            $pdo->prepare("UPDATE subjects SET indicators=? WHERE id=?")->execute([json_encode($inds, JSON_UNESCAPED_UNICODE), $sid]);
            $response=['success'=>true];
            break;
        case 'deleteIndicatorFromSubject':
            $sid=$input['subjectId']; $iid=$input['indicatorId'];
            $inds = json_decode($pdo->query("SELECT indicators FROM subjects WHERE id='$sid'")->fetchColumn(), true) ?? [];
            $new = array_filter($inds, function($i) use($iid){ return $i['id']!==$iid; });
            $pdo->prepare("UPDATE subjects SET indicators=? WHERE id=?")->execute([json_encode(array_values($new), JSON_UNESCAPED_UNICODE), $sid]);
            $response=['success'=>true];
            break;

        // ============================================================
        // 6. SCORES & GRADES
        // ============================================================
        case 'getScoresForEntry':
            $cid=$input['classId']; $sid=$input['subjectId']; $sem=$input['semester']; $yr=$input['year'];
            $sub = $pdo->query("SELECT * FROM subjects WHERE id='$sid'")->fetch(); decodeJsonField($sub,'indicators');
            // ดึงนักเรียน (เรียงตามเลขที่)
            $stds = $pdo->query("SELECT id, student_code, prefix, firstname, lastname, student_number FROM students WHERE class_id='$cid' AND status='active' ORDER BY student_number")->fetchAll();
            $scs = $pdo->prepare("SELECT * FROM scores WHERE subject_id=? AND semester=? AND year=?"); $scs->execute([$sid, $sem, $yr]);
            $map = []; foreach($scs->fetchAll() as $s) { decodeJsonField($s,'scores'); $map[$s['student_id']]=$s; }
            
            $data = [];
            foreach($stds as $st) {
                $sc = $map[$st['id']] ?? null;
                $data[] = [
                    'student_id'=>$st['id'], 'student_code'=>$st['student_code'],
                    'student_name'=>trim($st['prefix'].' '.$st['firstname'].' '.$st['lastname']),
                    'student_number'=>$st['student_number'],
                    'scores'=> $sc ? $sc['scores'] : ['indicators'=>[], 'final'=>null],
                    'total_score'=> $sc['total_score']??0, 'grade'=> $sc['grade']??'-'
                ];
            }
            $response=['success'=>true, 'data'=>['studentsWithScores'=>$data, 'subject'=>$sub]];
            break;

        case 'batchSaveScores':
            $sid=$input['subjectId']; $sem=$input['semester']; $yr=$input['year'];
            $inds = json_decode($pdo->query("SELECT indicators FROM subjects WHERE id='$sid'")->fetchColumn(), true) ?? [];
            $updated=[];
            foreach($input['studentScores'] as $s) {
                $raw=$s['scores']; $totInd=0; $maxInd=0;
                foreach($inds as $i) { $v=floatval($raw['indicators'][$i['id']]??0); $m=$i['max']; if($v>$m)$v=$m; $totInd+=$v; $maxInd+=$m; }
                
                $cwRatio = $input['courseworkRatio']; $fnRatio = $input['finalRatio'];
                $cw = ($maxInd>0)? round(($totInd/$maxInd)*$cwRatio) : 0;
                $fn = floatval($raw['final']??0); if($fn>$fnRatio) $fn=$fnRatio;
                $total = $cw + round($fn);
                
                $gr='0'; $gpa=0; $pass='ไม่ผ่าน';
                if($total>=80){$gr='4';$gpa=4.0;$pass='ผ่าน';} elseif($total>=75){$gr='3.5';$gpa=3.5;$pass='ผ่าน';}
                elseif($total>=70){$gr='3';$gpa=3.0;$pass='ผ่าน';} elseif($total>=65){$gr='2.5';$gpa=2.5;$pass='ผ่าน';}
                elseif($total>=60){$gr='2';$gpa=2.0;$pass='ผ่าน';} elseif($total>=55){$gr='1.5';$gpa=1.5;$pass='ผ่าน';}
                elseif($total>=50){$gr='1';$gpa=1.0;$pass='ผ่าน';}

                $json=json_encode($raw, JSON_UNESCAPED_UNICODE);
                $chk=$pdo->prepare("SELECT id FROM scores WHERE student_id=? AND subject_id=? AND year=? AND semester=?");
                $chk->execute([$s['student_id'], $sid, $yr, $sem]);
                if($exist=$chk->fetch()) {
                    $pdo->prepare("UPDATE scores SET scores=?, total_score=?, grade=?, gpa_value=?, pass_status=?, updated_at=NOW() WHERE id=?")
                        ->execute([$json, $total, $gr, $gpa, $pass, $exist['id']]);
                } else {
                    $pdo->prepare("INSERT INTO scores (id,student_id,subject_id,year,semester,scores,total_score,grade,gpa_value,pass_status,teacher_id,created_at) VALUES (UUID(),?,?,?,?,?,?,?,?,?,?,NOW())")
                        ->execute([$s['student_id'], $sid, $yr, $sem, $json, $total, $gr, $gpa, $pass, $_SESSION['user']['id']]);
                }
                $s['total_score']=$total; $s['grade']=$gr; $s['pass_status']=$pass;
                $updated[]=$s;
            }
            $response=['success'=>true, 'data'=>$updated];
            break;

        // ============================================================
        // 7. ATTENDANCE & OTHERS
        // ============================================================
        case 'getAttendanceData':
            $cid=$input['classId']; $date=$input['date'];
            $stds = $pdo->query("SELECT id, student_code, prefix, firstname, lastname, student_number, photo_url FROM students WHERE class_id='$cid' AND status='active' ORDER BY student_number")->fetchAll();
            $att = $pdo->prepare("SELECT * FROM attendance WHERE class_id=? AND date=?"); $att->execute([$cid, $date]);
            $map = []; foreach($att->fetchAll() as $a) $map[$a['student_id']]=$a;
            
            $res = [];
            foreach($stds as $s) {
                $a = $map[$s['id']] ?? null;
                $res[] = [
                    'student_id'=>$s['id'], 'student_code'=>$s['student_code'],
                    'student_name'=>trim($s['prefix'].' '.$s['firstname'].' '.$s['lastname']),
                    'student_number'=>$s['student_number'], 'photo_url'=>$s['photo_url'],
                    'status'=>$a?$a['status']:'not_recorded', 'note'=>$a?$a['note']:'', 'id'=>$a?$a['id']:null
                ];
            }
            $response=['success'=>true, 'data'=>$res];
            break;

        case 'batchSaveAttendance':
            $cid=$input['classId']; $date=$input['date']; $uid=$_SESSION['user']['id'];
            foreach($input['records'] as $r) {
                $chk=$pdo->prepare("SELECT id FROM attendance WHERE student_id=? AND date=? AND class_id=?");
                $chk->execute([$r['student_id'], $date, $cid]);
                if($ex=$chk->fetch()) {
                    $pdo->prepare("UPDATE attendance SET status=?, note=?, recorded_by=?, updated_at=NOW() WHERE id=?")->execute([$r['status'], $r['note'], $uid, $ex['id']]);
                } else {
                    $pdo->prepare("INSERT INTO attendance (id,student_id,class_id,date,status,note,recorded_by,created_at) VALUES (UUID(),?,?,?,?,?,?,NOW())")->execute([$r['student_id'], $cid, $date, $r['status'], $r['note'], $uid]);
                }
            }
            $response=['success'=>true];
            break;

        // Generic Get/Save for Behavior, Activities, Reading
        case 'getBehaviorData':
        case 'getActivityData':
        case 'getReadingData':
            $tbl = ($action=='getBehaviorData')?'behaviors':(($action=='getActivityData')?'activities':'readings');
            $stds = $pdo->query("SELECT id, student_code, prefix, firstname, lastname, student_number FROM students WHERE class_id='{$input['classId']}' AND status='active' ORDER BY student_number")->fetchAll();
            $rows = $pdo->prepare("SELECT * FROM $tbl WHERE class_id=? AND semester=? AND year=?");
            $rows->execute([$input['classId'], $input['semester'], $input['year']]);
            $map = []; foreach($rows->fetchAll() as $r) {
                if(isset($r['traits'])) decodeJsonField($r,'traits');
                if(isset($r['guidance'])) { decodeJsonField($r,'guidance'); decodeJsonField($r,'club'); decodeJsonField($r,'social_service'); decodeJsonField($r,'scout'); }
                $map[$r['student_id']] = $r;
            }
            $res=[];
            foreach($stds as $s) {
                $d = $map[$s['id']] ?? null;
                $item = [
                    'student_id'=>$s['id'], 'student_code'=>$s['student_code'],
                    'student_name'=>trim($s['prefix'].' '.$s['firstname'].' '.$s['lastname']),
                    'student_number'=>$s['student_number']
                ];
                if($tbl=='behaviors') {
                    $item['behavior_id']=$d['id']??null; $item['conduct_score']=$d['conduct_score']??100;
                    $item['overall_behavior']=$d['overall_behavior']??'ดีเยี่ยม'; $item['traits']=$d['traits']??[];
                    $item['positive_note']=$d['positive_note']??''; $item['improvement_note']=$d['improvement_note']??'';
                } elseif($tbl=='activities') {
                    $item['activity_id']=$d['id']??null; 
                    $item['guidance']=$d['guidance']??['status'=>'ผ่าน']; $item['club']=$d['club']??['status'=>'ผ่าน'];
                    $item['social_service']=$d['social_service']??['status'=>'ผ่าน']; $item['scout']=$d['scout']??['status'=>'ผ่าน'];
                } elseif($tbl=='readings') {
                    $item['reading_id']=$d['id']??null; $item['status']=$d['status']??'ดีเยี่ยม'; $item['note']=$d['note']??'';
                }
                $res[]=$item;
            }
            $response=['success'=>true, 'data'=>$res];
            break;

        case 'saveOrUpdateBehavior':
        case 'saveOrUpdateActivity':
        case 'saveOrUpdateReading':
            $d = $input; $tbl=''; $cols=[];
            if($action=='saveOrUpdateBehavior') { $tbl='behaviors'; $cols=['student_id','class_id','year','semester','conduct_score','overall_behavior','traits','positive_note','improvement_note','teacher_id']; $d['traits']=json_encode($d['traits'], JSON_UNESCAPED_UNICODE); }
            if($action=='saveOrUpdateActivity') { $tbl='activities'; $cols=['student_id','class_id','year','semester','guidance','club','social_service','scout','teacher_id']; $d['guidance']=json_encode($d['guidance'],JSON_UNESCAPED_UNICODE); $d['club']=json_encode($d['club'],JSON_UNESCAPED_UNICODE); $d['social_service']=json_encode($d['social_service'],JSON_UNESCAPED_UNICODE); $d['scout']=json_encode($d['scout'],JSON_UNESCAPED_UNICODE); }
            if($action=='saveOrUpdateReading') { $tbl='readings'; $cols=['student_id','class_id','year','semester','status','note','teacher_id']; }
            
            $d['teacher_id']=$_SESSION['user']['id'];
            if(!empty($d['id'])) {
                $set=[]; $v=[]; foreach($cols as $c){$set[]="$c=?"; $v[]=$d[$c];} $v[]=$d['id'];
                $pdo->prepare("UPDATE $tbl SET ".implode(',',$set).", updated_at=NOW() WHERE id=?")->execute($v);
            } else {
                $id=uuid(); $v=[$id]; foreach($cols as $c)$v[]=$d[$c];
                $pdo->prepare("INSERT INTO $tbl (id,".implode(',',$cols).",created_at) VALUES (?,".implode(',',array_fill(0,count($cols),'?')).",NOW())")->execute($v);
                $d['id']=$id;
            }
            $response=['success'=>true, 'data'=>$d];
            break;

        // ============================================================
        // 8. REPORTS & CONFIG
        // ============================================================
        case 'getConfig':
            $row=$pdo->query("SELECT setting_value FROM config WHERE setting_key='main_config'")->fetch();
            $response=['success'=>true, 'data'=>json_decode($row['setting_value'],true)??[]];
            break;
        case 'updateConfig':
            if(!empty($input['school_logo_base64'])) $input['school_logo_url']=saveImage($input['school_logo_base64'],'logo');
            unset($input['school_logo_base64']);
            $json=json_encode($input, JSON_UNESCAPED_UNICODE);
            $pdo->prepare("INSERT INTO config (setting_key,setting_value) VALUES ('main_config',?) ON DUPLICATE KEY UPDATE setting_value=?")->execute([$json,$json]);
            $response=['success'=>true, 'data'=>$input];
            break;
            
        // 9. TIMETABLE
        case 'getTimetable':
            $p=[$input['year'], $input['semester']]; $sql="SELECT t.*, s.subject_name, c.level, c.room FROM timetables t JOIN subjects s ON t.subject_id=s.id JOIN classes c ON t.class_id=c.id WHERE t.year=? AND t.semester=?";
            if(!empty($input['teacherId'])){ $sql.=" AND t.teacher_id=?"; $p[]=$input['teacherId']; }
            $res=$pdo->prepare($sql); $res->execute($p); $rows=$res->fetchAll();
            foreach($rows as &$r) $r['class_name']=$r['level'].'/'.$r['room'];
            $response=['success'=>true, 'data'=>$rows];
            break;
        case 'getAllTimetableSlots':
            $rows=$pdo->prepare("SELECT t.*, s.subject_name, c.level, c.room, u.name as teacher_name FROM timetables t JOIN subjects s ON t.subject_id=s.id JOIN classes c ON t.class_id=c.id JOIN users u ON t.teacher_id=u.id WHERE t.year=? AND t.semester=?")->execute([$input['year'], $input['semester']]);
            // (Note: fetchAll needed)
            $stmt=$pdo->prepare("SELECT t.*, s.subject_name, c.level, c.room, u.name as teacher_name FROM timetables t JOIN subjects s ON t.subject_id=s.id JOIN classes c ON t.class_id=c.id JOIN users u ON t.teacher_id=u.id WHERE t.year=? AND t.semester=?");
            $stmt->execute([$input['year'], $input['semester']]); $rows=$stmt->fetchAll();
            foreach($rows as &$r) $r['class_name']=$r['level'].'/'.$r['room'];
            $response=['success'=>true, 'data'=>$rows];
            break;
        case 'saveTimetableSlot':
            $d=$input;
            if(!empty($d['id'])) {
                $pdo->prepare("UPDATE timetables SET teacher_id=?, class_id=?, subject_id=?, year=?, semester=?, day=?, period=? WHERE id=?")
                    ->execute([$d['teacher_id'], $d['class_id'], $d['subject_id'], $d['year'], $d['semester'], $d['day'], $d['period'], $d['id']]);
            } else {
                $d['id']=uuid();
                $pdo->prepare("INSERT INTO timetables (id, teacher_id, class_id, subject_id, year, semester, day, period) VALUES (?,?,?,?,?,?,?,?)")
                    ->execute([$d['id'], $d['teacher_id'], $d['class_id'], $d['subject_id'], $d['year'], $d['semester'], $d['day'], $d['period']]);
            }
            $response=['success'=>true, 'data'=>$d];
            break;
        case 'deleteTimetableSlot':
            $pdo->prepare("DELETE FROM timetables WHERE id=?")->execute([$input['id']]);
            $response=['success'=>true];
            break;
        case 'getTeacherTimetable':
            $tid=$_SESSION['user']['id'];
            $cfg=json_decode($pdo->query("SELECT setting_value FROM config WHERE setting_key='main_config'")->fetchColumn(), true);
            $yr=$cfg['current_year']; $sm=$cfg['current_semester'];
            $rows=$pdo->prepare("SELECT t.*, s.subject_name, c.level, c.room FROM timetables t JOIN subjects s ON t.subject_id=s.id JOIN classes c ON t.class_id=c.id WHERE t.teacher_id=? AND t.year=? AND t.semester=?");
            $rows->execute([$tid, $yr, $sm]); $data=$rows->fetchAll();
            foreach($data as &$r) $r['class_name']=$r['level'].'/'.$r['room'];
            $response=['success'=>true, 'data'=>['timetable'=>$data, 'teacherName'=>$_SESSION['user']['name'], 'year'=>$yr, 'semester'=>$sm, 'periods'=>$cfg['timetable_periods']??[], 'config'=>$cfg]];
            break;
        case 'getStudentTimetable':
            $sid=$_SESSION['user']['id']; $cid=$_SESSION['user']['class_id'];
            $cfg=json_decode($pdo->query("SELECT setting_value FROM config WHERE setting_key='main_config'")->fetchColumn(), true);
            $rows=$pdo->prepare("SELECT t.*, s.subject_name, u.name as teacher_name FROM timetables t JOIN subjects s ON t.subject_id=s.id JOIN users u ON t.teacher_id=u.id WHERE t.class_id=? AND t.year=? AND t.semester=?");
            $rows->execute([$cid, $cfg['current_year'], $cfg['current_semester']]);
            $cls=$pdo->prepare("SELECT * FROM classes WHERE id=?"); $cls->execute([$cid]);
            $response=['success'=>true, 'data'=>['timetable'=>$rows->fetchAll(), 'student'=>$_SESSION['user'], 'classInfo'=>$cls->fetch(), 'config'=>$cfg]];
            break;

        // Reports Data (Simple fetch for lists)
        case 'getStudentListReportData':
             $sql = "SELECT * FROM students WHERE 1=1"; $p=[];
             if($input['classId']) { $sql.=" AND class_id=?"; $p[]=$input['classId']; }
             if($input['status']) { $sql.=" AND status=?"; $p[]=$input['status']; }
             $sql.=" ORDER BY student_number";
             $stmt=$pdo->prepare($sql); $stmt->execute($p);
             $response=['success'=>true, 'data'=>$stmt->fetchAll()];
             break;

        default:
            $response['message'] = "Function '$action' not implemented.";
    }

} catch (Exception $e) {
    $response['message'] = 'Server Error: ' . $e->getMessage();
}

echo json_encode($response);
?>