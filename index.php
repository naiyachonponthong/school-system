<?php
// 1. ส่วน PHP: เชื่อมต่อฐานข้อมูลและดึงค่า Config
require_once 'backend/db.php';

$schoolLogo = '';
$schoolName = 'ระบบ ปพ.5 และ ปพ.6';
$schoolSubName = 'โรงเรียนประถมศึกษา';

try {
    // ดึงข้อมูลจากตาราง config
    $stmt = $pdo->query("SELECT config_json FROM config LIMIT 1");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($row && !empty($row['config_json'])) {
        $config = json_decode($row['config_json'], true);
        if (!empty($config['school_logo_url'])) {
            $schoolLogo = $config['school_logo_url'];
        }
        if (!empty($config['school_name'])) {
            $schoolName = $config['school_name'];
        }
        if (!empty($config['app_name'])) {
            $schoolSubName = $schoolName;
            $schoolName = $config['app_name'];
        }
    }
} catch (Exception $e) {
    // กรณีเชื่อมต่อไม่ได้ ให้ใช้ค่า Default
}
?>
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= htmlspecialchars($schoolName) ?></title>
  
  <!-- Libraries -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script type="text/javascript" src="https://code.jquery.com/jquery-3.2.1.min.js"></script>
  <script type="text/javascript" src="https://earthchie.github.io/jquery.Thailand.js/jquery.Thailand.js/dependencies/JQL.min.js"></script>
  <script type="text/javascript" src="https://earthchie.github.io/jquery.Thailand.js/jquery.Thailand.js/dependencies/typeahead.bundle.js"></script>
  <link rel="stylesheet" href="https://earthchie.github.io/jquery.Thailand.js/jquery.Thailand.js/dist/jquery.Thailand.min.css">
  <script type="text/javascript" src="https://earthchie.github.io/jquery.Thailand.js/jquery.Thailand.js/dist/jquery.Thailand.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: { extend: { fontFamily: { 'sans': ['Sarabun', 'ui-sans-serif', 'system-ui'] } } }
    }
  </script>

  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body class="bg-gray-50 transition-colors duration-200">
  
  <!-- 1. Loading Overlay -->
  <div id="loadingOverlay" class="fixed inset-0 bg-white/80 dark:bg-gray-900/85 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center transition-all duration-500 ease-out">
    <div class="relative flex flex-col items-center">
        <div class="relative mb-6">
            <?php if ($schoolLogo): ?>
                <!-- กรณีมีโลโก้ -->
                <div class="w-28 h-28 bg-white rounded-full flex items-center justify-center shadow-xl animate-bounce-gentle relative z-10 p-2 overflow-hidden">
                    <img src="<?= htmlspecialchars($schoolLogo) ?>" class="w-full h-full object-contain">
                </div>
            <?php else: ?>
                <!-- กรณีไม่มีโลโก้ (ใช้ไอคอน) -->
                <div class="w-28 h-28 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-xl animate-bounce-gentle relative z-10">
                    <i class="fas fa-school text-5xl text-white"></i>
                </div>
            <?php endif; ?>
            <div class="absolute inset-0 bg-blue-500 rounded-full opacity-20 animate-ping z-0"></div>
        </div>
        <h3 id="loadingTitle" class="text-2xl font-bold text-gray-800 dark:text-white mb-2 tracking-wide">กำลังเข้าสู่ระบบ...</h3>
        <p id="loadingText" class="text-gray-500 dark:text-gray-300 text-sm font-light animate-pulse">กรุณารอสักครู่ ระบบกำลังเตรียมความพร้อม</p>
        <div class="w-64 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-8 overflow-hidden relative">
            <div class="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500 to-transparent w-1/2 animate-progress h-full rounded-full"></div>
        </div>
    </div>
  </div>

  <!-- 2. Login Page -->
  <div id="loginPage" class="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 border border-gray-100 relative overflow-hidden">
      <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-purple-600"></div>

      <div class="text-center mb-8">
        <div id="logoContainer" class="inline-block bg-blue-50 rounded-full p-4 mb-4">
            <?php if ($schoolLogo): ?>
                <img src="<?= htmlspecialchars($schoolLogo) ?>" class="w-20 h-20 object-contain">
            <?php else: ?>
                <i class="fas fa-school text-5xl text-blue-600"></i>
            <?php endif; ?>
        </div>
        <h1 class="text-3xl font-bold text-gray-800 mb-2"><?= htmlspecialchars($schoolName) ?></h1>
        <p class="text-gray-600"><?= htmlspecialchars($schoolSubName) ?></p>
      </div>

      <!-- Tab Switcher -->
      <div class="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
        <button type="button" onclick="switchLoginTab('teacher')" class="flex-1 py-2 px-4 rounded-md font-medium transition-colors teacher-tab active bg-white text-blue-600 shadow-sm">
          <i class="fas fa-chalkboard-user mr-2"></i>ครู / ผู้ดูแลระบบ
        </button>
        <button type="button" onclick="switchLoginTab('student')" class="flex-1 py-2 px-4 rounded-md font-medium transition-colors student-tab text-gray-600 hover:text-gray-800">
          <i class="fas fa-user-graduate mr-2"></i>นักเรียน
        </button>
      </div>

      <!-- Teacher Form -->
      <form id="teacherLoginForm" class="space-y-6 teacher-form">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2"><i class="fas fa-user mr-2"></i>ชื่อผู้ใช้</label>
          <input type="text" id="teacher_username" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" placeholder="กรอก Username">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2"><i class="fas fa-lock mr-2"></i>รหัสผ่าน</label>
          <div class="relative">
            <input type="password" id="teacher_password" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10 transition-all" placeholder="กรอก Password">
            <button type="button" onclick="togglePasswordVisibility('teacher_password', 'icon_teacher_pass')" class="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-blue-600 focus:outline-none" tabindex="-1">
              <i id="icon_teacher_pass" class="fas fa-eye"></i>
            </button>
          </div>
        </div>
        <button type="submit" onclick="handleLogin(event)" class="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 shadow-md hover:shadow-lg">
          <i class="fas fa-sign-in-alt"></i><span>เข้าสู่ระบบ</span>
        </button>
      </form>

      <!-- Student Form -->
      <form id="studentLoginForm" class="space-y-6 student-form hidden">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2"><i class="fas fa-id-card mr-2"></i>รหัสนักเรียน</label>
          <input type="text" id="student_id" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" placeholder="กรอก รหัสนักเรียน">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2"><i class="fas fa-lock mr-2"></i>เลขประจำตัวประชาชน</label>
          <div class="relative">
            <input type="password" id="student_id_card" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent pr-10 transition-all" placeholder="กรอก เลขประจำตัวประชาชน">
            <button type="button" onclick="togglePasswordVisibility('student_id_card', 'icon_student_pass')" class="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-green-600 focus:outline-none" tabindex="-1">
              <i id="icon_student_pass" class="fas fa-eye"></i>
            </button>
          </div>
        </div>
        <button type="submit" onclick="handleStudentLogin(event)" class="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 shadow-md hover:shadow-lg">
          <i class="fas fa-sign-in-alt"></i><span>เข้าสู่ระบบ</span>
        </button>
      </form>

      <div class="mt-8 text-center text-xs text-gray-400">Version 2.0.0 (PHP Edition)</div>
    </div>
  </div>

  <!-- 3. Main Application -->
  <div id="mainApp" class="hidden">
    
    <!-- Navbar -->
    <nav class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 fixed top-0 left-0 right-0 z-40 h-16 transition-colors">
      <div class="px-4 md:px-6 h-full flex items-center justify-between">
        <div class="flex items-center space-x-3 md:space-x-4">
          <button onclick="toggleSidebar()" class="p-2 -ml-2 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <i id="sidebarToggleIcon" class="fas fa-arrow-left text-xl"></i>
          </button>
          <div class="flex items-center space-x-3">
             <!-- Logo in Navbar -->
             <?php if ($schoolLogo): ?>
                <img src="<?= htmlspecialchars($schoolLogo) ?>" class="w-8 h-8 md:w-10 md:h-10 rounded-lg object-contain bg-white p-0.5 border border-gray-100">
            <?php else: ?>
                <div class="bg-blue-100 dark:bg-blue-900 rounded-lg p-1.5 md:p-2">
                    <i class="fas fa-school text-xl md:text-2xl text-blue-600 dark:text-blue-400"></i>
                </div>
            <?php endif; ?>
            
            <div>
              <h1 class="text-lg md:text-xl font-bold text-gray-800 dark:text-white leading-tight"><?= htmlspecialchars($schoolName) ?></h1>
              <p class="text-xs text-gray-500 dark:text-gray-400 hidden md:block"><?= htmlspecialchars($schoolSubName) ?></p>
            </div>
          </div>
        </div>
        
        <div class="flex items-center space-x-1 md:space-x-2">
          <!-- Dark Mode Toggle -->
          <button onclick="toggleTheme()" class="p-2.5 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-yellow-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300 focus:outline-none transform hover:scale-110">
            <i id="themeIcon" class="fas fa-moon text-lg md:text-xl"></i>
          </button>

          <!-- Notification -->
          <div class="relative">
            <button onclick="toggleNotificationDropdown()" class="relative p-2.5 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none">
              <i class="fas fa-bell text-lg md:text-xl"></i>
              <span id="notificationCount" class="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-white dark:border-gray-800 hidden">0</span>
            </button>
            <div id="notificationDropdown" class="hidden absolute right-0 mt-3 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden transform origin-top-right transition-all duration-200">
               <div id="notificationList" class="max-h-80 overflow-y-auto p-2"></div>
            </div>
          </div>

          <!-- Profile Dropdown -->
          <div class="relative">
            <button onclick="toggleProfileDropdown()" class="flex items-center space-x-2 md:space-x-3 p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600">
              <div id="navUserAvatar" class="w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-white font-semibold bg-gradient-to-br from-blue-500 to-purple-600 overflow-hidden shadow-sm dark:from-blue-600 dark:to-purple-700">
                <span id="userInitial">A</span>
              </div>
              <div class="hidden md:block text-left">
                <p id="userName" class="text-sm font-semibold text-gray-800 dark:text-white leading-none mb-0.5">Admin</p>
                <p id="userRole" class="text-xs text-gray-500 dark:text-gray-400 leading-none">ผู้ดูแลระบบ</p>
              </div>
              <i class="fas fa-chevron-down text-xs text-gray-400 dark:text-gray-500 hidden md:block ml-1"></i>
            </button>
            
            <div id="profileDropdown" class="hidden absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden transform origin-top-right transition-all duration-200">
              <div class="py-1">
                <a href="#" onclick="navigateTo('profile'); toggleProfileDropdown(); return false;" class="flex items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-700 dark:hover:text-blue-400 transition-colors">
                  <i class="fas fa-user-circle w-5 mr-3 text-lg opacity-70"></i> โปรไฟล์ส่วนตัว
                </a>
                <div class="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                <a href="#" onclick="handleLogout()" class="flex items-center px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-gray-700 transition-colors">
                  <i class="fas fa-sign-out-alt w-5 mr-3 text-lg opacity-70"></i> ออกจากระบบ
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>

    <div id="sidebarOverlay" class="hidden md:hidden fixed inset-0 bg-black bg-opacity-50 z-40 backdrop-blur-sm transition-opacity" onclick="toggleSidebar()"></div>

    <div class="flex pt-16">
      <aside id="sidebar" class="fixed top-0 left-0 h-screen z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto -translate-x-full transition-transform duration-300 ease-in-out md:translate-x-0 md:top-16 md:h-[calc(100vh-64px)] md:shadow-none shadow-2xl">
         <!-- Sidebar content injected by JS -->
      </aside>

      <main id="contentArea" class="flex-1 p-4 md:p-6 min-h-screen transition-all duration-300 ease-in-out md:ml-64 bg-gray-50 dark:bg-gray-900">
        <div id="breadcrumb" class="mb-6"></div>
        <div id="pageContent" class="max-w-[98%] mx-auto"></div>
        
        <footer class="mt-12 py-6 text-center text-gray-400 dark:text-gray-500 text-sm border-t border-gray-200 dark:border-gray-700">
          <p>&copy; <?= date('Y') + 543 ?> <?= htmlspecialchars($schoolSubName) ?>. All rights reserved.</p>
          <p class="text-xs mt-1">System v2.0.0 (PHP)</p>
        </footer>
      </main>
    </div>
  </div>

  <div id="modalsContainer"></div>
  <div id="toastContainer" class="fixed top-20 right-4 z-[52] space-y-2 pointer-events-none"></div>

  <!-- 4. JavaScript Bridge -->
  <script>
    function callServerFunction(functionName, ...args) {
      return new Promise(async (resolve, reject) => {
        const sessionToken = localStorage.getItem('sessionToken');
        try {
          const response = await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: functionName,
              token: sessionToken,
              params: args
            })
          });
          
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const result = await response.json();

          if (result.success === false && result.message === 'Session expired') {
             handleLogout();
             reject(new Error('Session expired'));
          } else {
             resolve(result);
          }
        } catch (error) {
          console.error(`Error calling ${functionName}:`, error);
          reject(error);
        }
      });
    }

    function handleLogout() {
        localStorage.removeItem('sessionToken');
        window.location.reload();
    }

    // รายชื่อไฟล์ JS ที่ต้องโหลด (เรียงลำดับความสำคัญ)
    const scripts = [
      'assets/js/utils.js',
      'assets/js/components.js',
      'assets/js/pages.js',
      'assets/js/page_attendance.js',
      'assets/js/page_behaviors.js',
      'assets/js/page_activities.js',
      'assets/js/page_grades.js',
      'assets/js/page_pp5.js',
      'assets/js/page_pp6.js',
      'assets/js/page_reports.js',
      'assets/js/page_reading.js',
      'assets/js/page_timetable.js',
      'assets/js/main.js' // Main ต้องโหลดเป็นลำดับสุดท้าย
    ];

    // ฟังก์ชันโหลดสคริปต์ทีละไฟล์ (Recursive)
    function loadScripts(index = 0) {
        if (index < scripts.length) {
            const script = document.createElement('script');
            script.src = scripts[index];
            script.onload = () => loadScripts(index + 1); // โหลดไฟล์ถัดไปเมื่อเสร็จ
            document.body.appendChild(script);
        } else {
            // ⭐️ เมื่อโหลดครบทุกไฟล์แล้ว ค่อยเริ่มระบบ ⭐️
            initSystem();
        }
    }
    
    // เริ่มโหลดไฟล์ JS
    loadScripts();

    // ฟังก์ชันเริ่มระบบ (ทำงานหลังจากโหลด JS ครบ)
    async function initSystem() {
        console.log('All scripts loaded. Initializing system...');
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loginPage = document.getElementById('loginPage');
        const mainApp = document.getElementById('mainApp');
        
        const token = localStorage.getItem('sessionToken');

        if (token) {
            try {
                // เรียกผ่าน api.php (ใช้ฟังก์ชันจาก main.js ได้แล้ว)
                const res = await callServerFunction('validateSession');
                
                if (res.success) {
                    // Login สำเร็จ
                    window.currentUser = res.user;
                    window.sessionToken = token;
                    
                    // ซ่อน Login / แสดง App
                    loginPage.classList.add('hidden');
                    mainApp.classList.remove('hidden');
                    
                    // Update UI
                    if(document.getElementById('userName')) document.getElementById('userName').innerText = res.user.name;
                    if(document.getElementById('userRole')) document.getElementById('userRole').innerText = res.user.role;
                    
                    // โหลดข้อมูลเริ่มต้น (Sidebar, Dashboard)
                    if(typeof renderSidebar === 'function') renderSidebar(res.user.role);
                    if(typeof updateNavbarAvatar === 'function') updateNavbarAvatar();
                    if(typeof navigateTo === 'function') navigateTo('dashboard');

                } else {
                    // Token ไม่ผ่าน -> บังคับ Logout
                    handleLogout();
                }
            } catch (error) {
                console.error('Init Error:', error);
                handleLogout();
            }
        } else {
            // ไม่มี Token -> อยู่หน้า Login
            loginPage.classList.remove('hidden');
            mainApp.classList.add('hidden');
        }

        // ⭐️ ปิด Loading Overlay เสมอ ไม่ว่าจะเกิดอะไรขึ้น
        setTimeout(() => {
            loadingOverlay.classList.add('hidden');
        }, 500);
    }

    // Helpers for Login Form (ต้องมีไว้ตรงนี้เพื่อให้ HTML เรียกใช้ได้ทันที)
    function togglePasswordVisibility(inputId, iconId) {
      const input = document.getElementById(inputId);
      const icon = document.getElementById(iconId);
      if (input.type === "password") {
        input.type = "text";
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
      } else {
        input.type = "password";
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      }
    }
    
    function switchLoginTab(type) {
        const teacherForm = document.querySelector('.teacher-form');
        const studentForm = document.querySelector('.student-form');
        const teacherTab = document.querySelector('.teacher-tab');
        const studentTab = document.querySelector('.student-tab');

        if(type === 'teacher') {
            teacherForm.classList.remove('hidden');
            studentForm.classList.add('hidden');
            teacherTab.classList.add('active', 'bg-white', 'text-blue-600');
            studentTab.classList.remove('active', 'bg-white', 'text-blue-600');
        } else {
            teacherForm.classList.add('hidden');
            studentForm.classList.remove('hidden');
            studentTab.classList.add('active', 'bg-white', 'text-blue-600');
            teacherTab.classList.remove('active', 'bg-white', 'text-blue-600');
        }
    }
    
    // ป้องกัน Form Submit แบบปกติ
    document.addEventListener('DOMContentLoaded', () => {
        const teacherForm = document.getElementById('teacherLoginForm');
        const studentForm = document.getElementById('studentLoginForm');
        if(teacherForm) teacherForm.addEventListener('submit', (e) => e.preventDefault());
        if(studentForm) studentForm.addEventListener('submit', (e) => e.preventDefault());
    });
  </script>
</body>
</html>