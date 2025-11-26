<?php
function uuid() {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

function uploadBase64($base64, $folder = 'uploads') {
    if (!$base64 || strpos($base64, 'base64,') === false) return null;
    
    // Create folder if not exists
    if (!file_exists($folder)) mkdir($folder, 0777, true);

    $parts = explode(',', $base64);
    $data = base64_decode($parts[1]);
    
    // Detect Mime Type
    $f = finfo_open();
    $mime = finfo_buffer($f, $data, FILEINFO_MIME_TYPE);
    finfo_close($f);
    
    $ext = 'jpg';
    if ($mime === 'image/png') $ext = 'png';
    if ($mime === 'image/jpeg') $ext = 'jpg';
    
    $filename = $folder . '/' . uniqid() . '.' . $ext;
    file_put_contents($filename, $data);
    
    // Return Full URL
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
    $domain = $_SERVER['HTTP_HOST'];
    $path = dirname($_SERVER['SCRIPT_NAME']);
    // Remove /backend if called from api.php
    $path = str_replace('/backend', '', $path); 
    
    return "$protocol://$domain$path/$filename";
}
?>