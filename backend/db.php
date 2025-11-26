<?php
$host = 'localhost';
$db   = 'school_db';
$user = 'root'; // แก้ให้ตรงกับเครื่องคุณ
$pass = '';     // แก้ให้ตรงกับเครื่องคุณ
$charset = 'utf8mb4';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=$charset", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false
    ]);
} catch (\PDOException $e) {
    die(json_encode(['success' => false, 'message' => 'Database Error: ' . $e->getMessage()]));
}
?>