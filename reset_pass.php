<?php
require 'backend/db.php';

// รหัสผ่านที่ต้องการตั้งใหม่
$newPassword = 'Admin@123456';
$hash = password_hash($newPassword, PASSWORD_DEFAULT);

$username = 'admin';

try {
    $stmt = $pdo->prepare("UPDATE users SET password = ? WHERE username = ?");
    $stmt->execute([$hash, $username]);
    
    echo "<h1>✅ รีเซ็ตรหัสผ่านสำเร็จ!</h1>";
    echo "User: <b>$username</b><br>";
    echo "Pass: <b>$newPassword</b><br>";
    echo "<br><a href='index.php'>กลับไปหน้าเข้าสู่ระบบ</a>";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>