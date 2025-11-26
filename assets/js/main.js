
/**
 * ===================================
 * CORE JAVASCRIPT FUNCTIONS
 * ===================================
 */

var globalNotifications = []; // ใช้ var แทน let เพื่อป้องกัน Error

// Global Variables
window.currentUser = null;
window.currentPage = 'dashboard';
window.sessionToken = null;


// ===================================
// INITIALIZATION
// ===================================

/**
 * เริ่มต้นระบบ
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 System initializing...');
  
  const sessionToken = localStorage.getItem('sessionToken');
  
  if (sessionToken) {
    // มี Token, ตรวจสอบกับ Server
    showLoading('กำลังตรวจสอบเซสชัน...');
    
    // 1. ⭐️ แก้ไขจุดที่ 1: เปลี่ยน google.script.run เป็น callServerFunction
    callServerFunction('validateSession', sessionToken)
      .then(handleSessionValidation)
      .catch(handleSessionError);
      
    // 2. ⭐️ แก้ไขจุดที่ 2: Auto-refresh session ก็ต้องเปลี่ยนด้วย
    setInterval(() => {
      const token = localStorage.getItem('sessionToken');
      if (token && window.currentUser) {
        callServerFunction('validateSession', token)
          .then((result) => {
            if (result.success) {
              console.log('✅ Session refreshed');
            }
          })
          .catch((error) => {
            console.warn('⚠️ Session refresh failed:', error.message);
          });
      }
    }, 30 * 60 * 1000); // ทุก 30 นาที
      
  } else {
    // ไม่มี Token, แสดงหน้า Login
    showLoginPage();
    hideLoading();
  }
});

/**
 * จัดการผลการตรวจสอบ Session
 * @param {Object} result - ผลลัพธ์จาก Server
 */
function handleSessionValidation(result) {
  if (result.success) {
    // Session ถูกต้อง
    window.sessionToken = localStorage.getItem('sessionToken');
    window.currentUser = result.user;
    
    console.log('✅ Session valid:', result.user);
    
    showMainApplication();
    
    // [ ⭐️⭐️⭐️ แก้ไข: Handle ทั้ง teacher/admin และ student ⭐️⭐️⭐️ ]
    if (result.user.role === 'student') {
      // สำหรับ student
      console.log('🎓 Student detected, rendering student sidebar...');
      renderStudentSidebar();
      navigateTo('studentGrades');
    } else {
      // สำหรับ teacher/admin
      console.log('👨‍🏫 Teacher/Admin detected, rendering standard sidebar...');
      renderSidebar(result.user.role);
      navigateTo('dashboard');
    }
    // [ ⭐️⭐️⭐️ สิ้นสุดส่วนที่แก้ไข ⭐️⭐️⭐️ ]
    
  } else {
    // Session ไม่ถูกต้อง/หมดอายุ
    console.warn('⚠️ Session invalid:', result.message);
    handleSessionError(new Error(result.message));
  }
  
  hideLoading();
}

/**
 * จัดการ Session Error
 * @param {Error} error - Error object
 */
function handleSessionError(error) {
  console.error('❌ Session Error:', error.message);
  localStorage.removeItem('sessionToken');
  window.sessionToken = null;
  window.currentUser = null;
  showLoginPage();
  hideLoading();
}

// ===================================
// AUTHENTICATION
// ===================================

/**
 * จัดการ Login
 * @param {Event} event - Form event
 */
async function handleLogin(event) { // หรือ handleTeacherLogin แล้วแต่ว่า HTML เรียกชื่อไหน
  event.preventDefault();
  
  // แก้ไขการดึง ID ให้ตรงกับ HTML (teacher_username / teacher_password)
  const usernameInput = document.getElementById('teacher_username') || document.getElementById('username');
  const passwordInput = document.getElementById('teacher_password') || document.getElementById('password');
  
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  
  if (!username || !password) {
    showToast('กรุณากรอก Username และ Password', 'warning');
    return;
  }
  
  showLoading('กำลังเข้าสู่ระบบ...');
  
  try {
    // ⭐️ แก้ไข: ใช้ callServerFunction แทน google.script.run
    const result = await callServerFunction('login', username, password);
    
    if (result.success) {
      localStorage.setItem('sessionToken', result.sessionToken);
      localStorage.setItem('userType', 'teacher');
      window.sessionToken = result.sessionToken;
      window.currentUser = result.user;
      
      showToast('เข้าสู่ระบบสำเร็จ', 'success');
      showMainApplication();
      renderSidebar(result.user.role);
      navigateTo('dashboard');
      
    } else {
      showToast(result.message, 'error');
    }
    
  } catch (error) {
    console.error('Login error:', error);
    showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

/**
 * สลับระหว่าง Tab Login (Teacher/Admin vs Student)
 * @param {string} tab - 'teacher' หรือ 'student'
 */
function switchLoginTab(tab) {
  const teacherForms = document.querySelectorAll('.teacher-form');
  const studentForms = document.querySelectorAll('.student-form');
  const teacherTab = document.querySelector('.teacher-tab');
  const studentTab = document.querySelector('.student-tab');
  
  if (tab === 'teacher') {
    teacherForms.forEach(el => el.classList.remove('hidden'));
    studentForms.forEach(el => el.classList.add('hidden'));
    teacherTab.classList.add('active', 'bg-white', 'text-blue-600');
    teacherTab.classList.remove('text-gray-600');
    studentTab.classList.remove('active', 'bg-white', 'text-blue-600');
    studentTab.classList.add('text-gray-600');
  } else if (tab === 'student') {
    teacherForms.forEach(el => el.classList.add('hidden'));
    studentForms.forEach(el => el.classList.remove('hidden'));
    studentTab.classList.add('active', 'bg-white', 'text-blue-600');
    studentTab.classList.remove('text-gray-600');
    teacherTab.classList.remove('active', 'bg-white', 'text-blue-600');
    teacherTab.classList.add('text-gray-600');
  }
}

/**
 * จัดการ Login สำหรับครู/Admin
 * @param {Event} event - Form event
 */
async function handleTeacherLogin(event) {
  event.preventDefault();
  
  const username = document.getElementById('teacher_username').value.trim();
  const password = document.getElementById('teacher_password').value;
  
  if (!username || !password) {
    showToast('กรุณากรอก Username และ Password', 'warning');
    return;
  }
  
  showLoading('กำลังเข้าสู่ระบบ...');
  
  try {
    const result = await new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .login(username, password);
    });
    
    if (result.success) {
      // เก็บ Session Token
      localStorage.setItem('sessionToken', result.sessionToken);
      localStorage.setItem('userType', 'teacher');
      window.sessionToken = result.sessionToken;
      window.currentUser = result.user;
      
      console.log('✅ Teacher Login successful:', result.user);
      
      showToast('เข้าสู่ระบบสำเร็จ', 'success');
      
      // แสดงหน้าหลัก
      showMainApplication();
      renderSidebar(result.user.role);
      navigateTo('dashboard');
      
    } else {
      showToast(result.message, 'error');
    }
    
  } catch (error) {
    console.error('Login error:', error);
    showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

/**
 * จัดการ Login สำหรับนักเรียน
 * @param {Event} event - Form event
 */
async function handleStudentLogin(event) {
  event.preventDefault();
  
  const studentId = document.getElementById('student_id').value.trim();
  const idCard = document.getElementById('student_id_card').value.trim();
  
  if (!studentId || !idCard) {
    showToast('กรุณากรอก รหัสนักเรียน และ เลขประจำตัวประชาชน', 'warning');
    return;
  }
  
  showLoading('กำลังเข้าสู่ระบบ...');
  
  try {
    // ⭐️ แก้ไข: ใช้ callServerFunction แทน google.script.run
    const result = await callServerFunction('loginStudent', studentId, idCard);
    
    if (result.success) {
      localStorage.setItem('sessionToken', result.sessionToken);
      localStorage.setItem('userType', 'student');
      window.sessionToken = result.sessionToken;
      window.currentUser = result.user;
      
      showToast('เข้าสู่ระบบสำเร็จ', 'success');
      showMainApplication();
      renderStudentSidebar(); // ตรวจสอบว่ามีฟังก์ชันนี้ใน components.js หรือไม่
      navigateTo('studentGrades');
      
    } else {
      showToast(result.message, 'error');
    }
    
  } catch (error) {
    console.error('Student Login error:', error);
    showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

window.handleTeacherLogin = handleLogin;

function handleLogout() {
  
  // 1. สร้างฟังก์ชันสำหรับสิ่งที่จะทำ "หลังจาก" กดยืนยัน
  const performLogout = () => {
    showLoading('กำลังออกจากระบบ...');
  
    const sessionToken = localStorage.getItem('sessionToken');
    
    // ลบ Token จาก LocalStorage
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('userType'); // ลบประเภทผู้ใช้ด้วย (ถ้ามี)
    
    // [⭐️ แก้ไขแล้ว ⭐️] แจ้ง Server (PHP) ให้ Clear Session
    // ใช้ callServerFunction แทน google.script.run
    if (sessionToken) {
      callServerFunction('logout', sessionToken)
        .catch(err => console.warn('Logout API warning:', err));
    }
    
    // Reset Global Variables
    window.sessionToken = null;
    window.currentUser = null;
    window.currentPage = 'dashboard';
    
    // ล้าง Avatar ใน Navbar
    const avatarContainer = document.getElementById('navUserAvatar');
    if (avatarContainer) {
      avatarContainer.innerHTML = '<span id="userInitial">A</span>';
      avatarContainer.classList.add('bg-gradient-to-br', 'from-blue-500', 'to-purple-600');
    }
    
    // กลับไปหน้า Login
    showLoginPage();
    
    hideLoading();
    showToast('ออกจากระบบสำเร็จ', 'success');
  };

  // 2. เรียกใช้ Pop up ยืนยัน
  showConfirmModal(
    'ยืนยันการออกจากระบบ',                 // Title
    'คุณต้องการออกจากระบบใช่หรือไม่?',      // Message
    performLogout,                       // Callback function (สิ่งที่จะทำเมื่อกดยืนยัน)
    {
      confirmText: 'ออกจากระบบ',            // Text on confirm button
      confirmColor: 'red',                 // Button color
      icon: 'fas fa-sign-out-alt'        // Icon
    }
  );
}

// ===================================
// NAVIGATION & ROUTING
// ===================================

/**
 * [ ⭐️ ใหม่ ⭐️ ]
 * เปิด/ปิด Sidebar
 * (แก้ไข: เพิ่มการสลับไอคอนลูกศร และตรรกะ "Mini")
 */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const contentArea = document.getElementById('contentArea');
  const icon = document.getElementById('sidebarToggleIcon');
  
  if (!sidebar || !overlay || !contentArea || !icon) {
    console.error('Sidebar, Overlay, ContentArea or Icon element not found.');
    return;
  }

  // [ ⭐️⭐️⭐️ NEW LOGIC ⭐️⭐️⭐️ ]
  
  const isMobile = window.innerWidth < 768; // 768px is 'md'
  
  if (isMobile) {
    // --- MOBILE LOGIC (Show/Hide) ---
    if (sidebar.classList.contains('-translate-x-full')) {
      // Open mobile menu
      sidebar.classList.remove('-translate-x-full');
      sidebar.classList.add('translate-x-0');
      overlay.classList.remove('hidden');
    } else {
      // Close mobile menu
      sidebar.classList.remove('translate-x-0');
      sidebar.classList.add('-translate-x-full');
      overlay.classList.add('hidden');
    }
  } else {
    // --- DESKTOP LOGIC (Expand/Collapse Mini) ---
    if (sidebar.classList.contains('sidebar-mini')) {
      // EXPAND (it's currently mini)
      sidebar.classList.remove('sidebar-mini');
      contentArea.classList.remove('md:ml-20'); // ใช้ ml-20 (80px)
      contentArea.classList.add('md:ml-64');
      icon.classList.remove('fa-arrow-right');
      icon.classList.add('fa-arrow-left');
    } else {
      // COLLAPSE (it's currently expanded)
      sidebar.classList.add('sidebar-mini');
      contentArea.classList.remove('md:ml-64');
      contentArea.classList.add('md:ml-20'); // ใช้ ml-20 (80px)
      icon.classList.remove('fa-arrow-left');
      icon.classList.add('fa-arrow-right');
    }
  }
}

/**
 * [ ⭐️ ใหม่ ⭐️ ]
 * เปิด/ปิด Dropdown โปรไฟล์
 */
function toggleProfileDropdown() {
  const dropdown = document.getElementById('profileDropdown');
  if (dropdown) {
    dropdown.classList.toggle('hidden');
  }
}

// [ ⭐️ ใหม่ ⭐️ ] ปิด Dropdown เมื่อคลิกที่อื่น
window.addEventListener('click', (e) => {
  const dropdown = document.getElementById('profileDropdown');
  const toggleButton = document.querySelector('[onclick="toggleProfileDropdown()"]');
  
  if (dropdown && !dropdown.classList.contains('hidden')) {
    if (!toggleButton.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  }
});

/**
 * Navigate ไปหน้าต่างๆ
 * (FIXED FOR DROPDOWNS)
 * @param {string} page - ชื่อหน้า
 */
function navigateTo(page) {
  window.currentPage = page;
  
  // 1. ปิด Active/Open ทั้งหมดก่อน
  document.querySelectorAll('.sidebar-link').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelectorAll('.sidebar-group').forEach(item => {
    item.classList.remove('open');
  });
  document.querySelectorAll('.sidebar-submenu').forEach(item => {
    item.classList.add('hidden');
  });
  document.querySelectorAll('.sidebar-group .fa-chevron-down').forEach(item => {
    item.classList.remove('rotate-180');
  });

  // 2. ค้นหา Link ที่ถูกเลือก
  const activeLink = document.querySelector(`.sidebar-link[data-page="${page}"]`);
  
  if (activeLink) {
    // 3. เพิ่ม .active ให้ Link
    activeLink.classList.add('active');
    
    // 4. ตรวจสอบว่าเป็น "เมนูย่อย" หรือไม่
    const parentSubmenu = activeLink.closest('.sidebar-submenu');
    if (parentSubmenu) {
      // 4.1 ถ้าใช่, ให้เปิด Submenu
      parentSubmenu.classList.remove('hidden');
      
      // 4.2 ค้นหา Group (ปุ่ม) ที่คุม Submenu นี้
      const groupId = parentSubmenu.id.replace('submenu-', '');
      const parentGroupButton = document.querySelector(`.sidebar-group[data-group-id="${groupId}"]`);
      
      if (parentGroupButton) {
        // 4.3 เพิ่ม .open และหมุนลูกศร
        parentGroupButton.classList.add('open');
        const arrowIcon = parentGroupButton.querySelector('.fa-chevron-down');
        if (arrowIcon) {
          arrowIcon.classList.add('rotate-180');
        }
      }
    }
  }

  // 5. (เดิม) ปิด Sidebar ในมือถือ
  if (window.innerWidth < 768) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('translate-x-0')) {
      toggleSidebar();
    }
  }
  
  // 6. (เดิม) Render Page
  switch (page) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'students':
      renderStudentsPage();
      break;
    case 'classes':
      renderClassesPage();
      break;
    case 'assign-subjects':
      renderAssignSubjectsPage();
      break;
    case 'subjects-crud':
      renderSubjectsCrudPage();
      break;
    case 'scores':
      renderScoresPage();
      break;
    case 'grades-view':
      renderGradesViewPage();
      break;
    case 'behaviors':
      renderBehaviorsPage();
      break;
    case 'activities':
      renderActivitiesPage();
      break;
    case 'reading':
      renderReadingSelectionPage();
      break;
    case 'attendance':
      renderAttendancePage();
      break;
      
    // ⭐️⭐️⭐️ [เพิ่มโค้ดส่วนนี้] ⭐️⭐️⭐️
    case 'timetable':
      renderTimetablePage();
      break;
    // ⭐️⭐️⭐️ [สิ้นสุดส่วนที่เพิ่ม] ⭐️⭐️⭐️
      
    case 'pp5':
      renderPP5Page();
      break;
    case 'pp6':
      renderPP6Page();
      break;
    case 'reports':
      renderReportsPage();
      break;
    case 'users':
      renderUsersPage();
      break;
    case 'studentGrades':
      renderStudentGradesPage();
      break;
    case 'studentAttendance':
      renderStudentAttendancePage();
      break;
    
    // ⭐️⭐️⭐️ [เพิ่มโค้ดส่วนนี้] ⭐️⭐️⭐️
    case 'studentTimetable':
      renderStudentTimetablePage(); // <-- ฟังก์ชันใหม่
      break;
    // ⭐️⭐️⭐️ [สิ้นสุดส่วนที่เพิ่ม] ⭐️⭐️⭐️

    case 'settings':
      renderSettingsPage();
      break;
    case 'profile':
      renderProfilePage();
      break;
    default:
      renderDashboard();
  }
  
  // 7. (เดิม) Scroll to top
  window.scrollTo(0, 0);
}

// ===================================
// UI HELPERS
// ===================================

/**
 * แสดงหน้า Login
 */
function showLoginPage() {
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('mainApp').classList.add('hidden');
  document.getElementById('modalsContainer').innerHTML = '';
  document.getElementById('toastContainer').innerHTML = '';
}

/**
 * แสดงหน้าหลัก
 * (แก้ไข: ตั้งค่าเริ่มต้นให้ถูกต้องสำหรับ "Mini Sidebar")
 */
function showMainApplication() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  
  if (window.currentUser) {
    updateNavbarAvatar(); 
    document.getElementById('userName').textContent = window.currentUser.name;
    document.getElementById('userRole').textContent = getRoleLabel(window.currentUser.role);
  }

  const sidebar = document.getElementById('sidebar');
  const contentArea = document.getElementById('contentArea');
  const icon = document.getElementById('sidebarToggleIcon');

  if (window.innerWidth >= 768) { 
    // DESKTOP: Start EXPANDED
    sidebar.classList.remove('-translate-x-full');
    sidebar.classList.add('translate-x-0');
    sidebar.classList.remove('sidebar-mini'); // Ensure not mini
    
    contentArea.classList.remove('md:ml-20'); // Ensure not mini margin
    contentArea.classList.add('md:ml-64');
    
    if (icon) { 
      icon.classList.remove('fa-arrow-right');
      icon.classList.add('fa-arrow-left');
    }
  } else {
    // MOBILE: Start HIDDEN
    sidebar.classList.add('-translate-x-full');
    sidebar.classList.remove('translate-x-0');
    sidebar.classList.remove('sidebar-mini'); // Ensure not mini
    
    contentArea.classList.remove('md:ml-64');
    contentArea.classList.remove('md:ml-20');
    
    if (icon) { 
      icon.classList.remove('fa-arrow-left');
      icon.classList.add('fa-arrow-right');
    }
  }
}

/**
 * [ ⭐️ ใหม่ ⭐️ ]
 * อัปเดต Avatar (รูป/ชื่อย่อ) บน Navbar
 */
function updateNavbarAvatar() {
  if (!window.currentUser) return;

  const avatarContainer = document.getElementById('navUserAvatar');
  const initialSpan = document.getElementById('userInitial');
  
  if (!avatarContainer) return;

  const photoUrl = window.currentUser.photo_url;
  const initial = getInitials(window.currentUser.name);

  // ล้าง HTML เดิมทั้งหมด
  avatarContainer.innerHTML = '';
  
  if (photoUrl && photoUrl.trim() !== '') {
    // 1. มีรูปโปรไฟล์
    // ลบพื้นหลังสีๆ
    avatarContainer.classList.remove('bg-gradient-to-br', 'from-blue-500', 'to-purple-600');
    // เพิ่มรูป (เพิ่ม cache buster เพื่อไม่ให้ browser cache รูปเก่า)
    const cacheBuster = new Date().getTime();
    avatarContainer.innerHTML = `<img src="${photoUrl}?t=${cacheBuster}" alt="${initial}" class="w-full h-full object-cover rounded-full">`;
  } else {
    // 2. ไม่มีรูป (ใช้ชื่อย่อ)
    // เพิ่มพื้นหลังสีๆ
    avatarContainer.classList.add('bg-gradient-to-br', 'from-blue-500', 'to-purple-600');
    // สร้าง Span ใหม่แทนที่จะใช้อันเก่า
    const newSpan = document.createElement('span');
    newSpan.id = 'userInitial';
    newSpan.textContent = initial;
    avatarContainer.appendChild(newSpan);
  }
}

/**
 * ได้ชื่อ Role
 * @param {string} role - Role
 * @returns {string} ชื่อ Role
 */
function getRoleLabel(role) {
  const roles = {
    'admin': 'ผู้ดูแลระบบ',
    'principal': 'ผู้อำนวยการ',
    'teacher': 'ครู',
    'homeroom': 'ครูประจำชั้น',
    'registrar': 'งานทะเบียน',
    'student': 'นักเรียน',
    'parent': 'ผู้ปกครอง'
  };
  return roles[role] || role;
}

/**
 * แสดง Loading Overlay พร้อมข้อความที่กำหนด
 * @param {string} title - ข้อความหัวข้อใหญ่ (เช่น กำลังบันทึก...)
 * @param {string} subtitle - ข้อความอธิบายเล็กๆ (ถ้าไม่ใส่ จะใช้ค่า default)
 */
function showLoading(title = 'กำลังประมวลผล...', subtitle = 'กรุณารอสักครู่ ระบบกำลังทำงาน') {
  const loader = document.getElementById('loadingOverlay');
  const titleEl = document.getElementById('loadingTitle'); // หัวข้อใหญ่
  const textEl = document.getElementById('loadingText');   // คำอธิบายเล็ก
  
  // อัปเดตข้อความหัวข้อใหญ่
  if (titleEl) titleEl.textContent = title;
  
  // อัปเดตคำอธิบาย (ถ้ามีการส่งมา)
  if (textEl) textEl.textContent = subtitle;
  
  if (loader) {
    loader.classList.remove('loader-hidden');
    loader.classList.remove('hidden');
  }
}

/**
 * ซ่อน Loading Overlay แบบนุ่มนวล
 */
function hideLoading() {
  const loader = document.getElementById('loadingOverlay');
  if (loader) {
    // เพิ่ม class เพื่อเริ่ม fade out (ตาม CSS ที่เราเพิ่มใน Styles.css)
    loader.classList.add('loader-hidden');
    
    // รอให้ Animation จบ (0.5s) แล้วค่อยซ่อน display จริงๆ (ถ้าจำเป็น)
    // แต่ใน CSS เราใช้ visibility: hidden ซึ่งเพียงพอแล้ว
  }
}

/**
 * แสดง Toast Notification
 * @param {string} message - ข้อความ
 * @param {string} type - ประเภท (success/error/warning/info)
 * @param {number} duration - ระยะเวลา (ms)
 */
function showToast(message, type = 'info', duration = 3000) {
  const toastId = 'toast_' + Date.now();
  
  const icons = {
    success: 'fas fa-check-circle',
    error: 'fas fa-times-circle',
    warning: 'fas fa-exclamation-circle',
    info: 'fas fa-info-circle'
  };
  
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  };
  
  const html = `
    <div id="${toastId}" class="toast-enter ${colors[type]} text-white px-6 py-4 rounded-lg shadow-lg flex items-center space-x-3 min-w-[300px]">
      <i class="${icons[type]} text-xl"></i>
      <span class="flex-1">${message}</span>
      <button onclick="removeToast('${toastId}')" class="text-white hover:text-gray-200">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
  
  const container = document.getElementById('toastContainer');
  container.insertAdjacentHTML('beforeend', html);
  
  // Auto remove
  setTimeout(() => {
    removeToast(toastId);
  }, duration);
}

/**
 * ลบ Toast
 * @param {string} toastId - Toast ID
 */
function removeToast(toastId) {
  const toast = document.getElementById(toastId);
  if (toast) {
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }
}

// ===================================
// GOOGLE SCRIPT RUN WRAPPER
// ===================================

/**
 * เรียก Google Script Run พร้อม Session Token
 * @param {string} functionName - ชื่อฟังก์ชัน
 * @param {...any} args - Arguments
 * @returns {Promise} Promise
 */
function callServerFunction(functionName, ...args) {
  return new Promise(async (resolve, reject) => { // อย่าลืม async ตรงนี้ถ้าจะใช้ await ข้างใน
    const sessionToken = localStorage.getItem('sessionToken');
    
    // ⭐️ แก้ไข: เพิ่มเงื่อนไขยกเว้นสำหรับ 'login' และ 'loginStudent'
    if (!sessionToken && functionName !== 'login' && functionName !== 'loginStudent') {
      reject(new Error('No session token'));
      return;
    }
    
    // ... ส่วนที่เหลือเหมือนเดิม (Fetch api.php) ...
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
        
        // ... (code ส่วนรับค่าและส่งกลับ) ...
        const result = await response.json();
        
        if (result.success === false && result.message === 'Session expired') {
             handleSessionError(new Error('Session expired')); // หรือเรียก handleLogout()
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

// ===================================
// UTILITY UI FUNCTIONS
// ===================================

/**
 * อัพเดท UI แบบ Optimistic
 * @param {Function} updateUI - ฟังก์ชันอัพเดท UI
 * @param {Function} serverCall - ฟังก์ชันเรียก Server
 * @param {Function} onSuccess - Callback เมื่อสำเร็จ
 * @param {Function} onError - Callback เมื่อล้มเหลว
 */
async function optimisticUpdate(updateUI, serverCall, onSuccess = null, onError = null) {
  // 1. อัพเดท UI ทันที
  updateUI();
  
  try {
    // 2. เรียก Server (background)
    const result = await serverCall();
    
    if (result.success) {
      // 3. สำเร็จ
      if (onSuccess) onSuccess(result);
    } else {
      // 4. ล้มเหลว - Rollback
      console.error('Server error:', result.message);
      if (onError) onError(result);
      showToast('เกิดข้อผิดพลาด: ' + result.message, 'error');
    }
    
  } catch (error) {
    // 5. Error - Rollback
    console.error('Network error:', error);
    if (onError) onError(error);
    showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
  }
}

/**
 * เรียก Server แล้วรอผล
 * (⭐️⭐️⭐️ แก้ไขแล้ว: ให้รองรับ Promise.all ⭐️⭐️⭐️)
 * @param {Function} serverCall - ฟังก์ชันเรียก Server
 * @param {string} loadingMessage - ข้อความ Loading
 * @param {Function} onSuccess - Callback เมื่อสำเร็จ
 * @param {Function} onError - Callback เมื่อล้มเหลว
 */
async function waitForResponse(serverCall, loadingMessage, onSuccess = null, onError = null) {
  showLoading(loadingMessage);
  
  try {
    const result = await serverCall();
    
    // ⭐️⭐️⭐️ [เพิ่มโค้ดแก้ไข] ⭐️⭐️⭐️
    // ตรวจสอบว่าผลลัพธ์เป็น Array (มาจาก Promise.all) หรือไม่
    if (Array.isArray(result)) {
      // ถ้าเป็น Array, ส่งต่อไปให้ onSuccess (ซึ่ง loadAdminTimetable จะจัดการเอง)
      if (onSuccess) onSuccess(result);
    
    } else if (result.success) {
    // ⭐️⭐️⭐️ [สิ้นสุดโค้ดแก้ไข] ⭐️⭐️⭐️
    
      // (โค้ดเดิม) ถ้าเป็น Object เดียว และสำเร็จ
      if (onSuccess) onSuccess(result);
    } else {
      // (โค้ดเดิม) ถ้าเป็น Object เดียว และล้มเหลว
      console.error('Server error:', result.message);
      if (onError) onError(result);
      // (เพิ่ม || 'Unknown error' เพื่อป้องกัน 'undefined')
      showToast('เกิดข้อผิดพลาด: ' + (result.message || 'Unknown error'), 'error'); 
    }
    
  } catch (error) {
    console.error('Network error:', error);
    if (onError) onError(error);
    // (เพิ่ม error.message เพื่อแสดงรายละเอียด)
    showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}
/**
 * Refresh หน้าปัจจุบัน
 */
function refreshCurrentPage() {
  navigateTo(window.currentPage);
}

/**
 * แสดง Modal แจ้งเตือน
 * @param {string} message - ข้อความ
 * @param {string} type - ประเภท
 */
function showAlert(message, type = 'info') {
  const icons = {
    success: 'fas fa-check-circle',
    error: 'fas fa-times-circle',
    warning: 'fas fa-exclamation-triangle',
    info: 'fas fa-info-circle'
  };
  
  const colors = {
    success: 'blue',
    error: 'red',
    warning: 'yellow',
    info: 'blue'
  };
  
  const modalId = 'alertModal_' + Date.now();
  
  const html = `
    <div id="${modalId}" class="modal-overlay fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div class="modal-content bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div class="text-center">
          <div class="inline-block bg-${colors[type]}-100 rounded-full p-4 mb-4">
            <i class="${icons[type]} text-3xl text-${colors[type]}-600"></i>
          </div>
          <p class="text-gray-700 mb-6">${message}</p>
          <button onclick="closeModal('${modalId}')" class="btn btn-primary w-full">
            ตกลง
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalsContainer').innerHTML = html;
}

/**
 * ตรวจสอบสิทธิ์
 * @param {string} requiredRole - Role ที่ต้องการ
 * @returns {boolean} มีสิทธิ์หรือไม่
 */
function checkPermission(requiredRole) {
  if (!window.currentUser) return false;
  
  const roleHierarchy = {
    'admin': 5,
    'principal': 4,
    'registrar': 3,
    'homeroom': 2,
    'teacher': 1
  };
  
  const userLevel = roleHierarchy[window.currentUser.role] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;
  
  return userLevel >= requiredLevel;
}

/**
 * แสดงข้อความไม่มีสิทธิ์
 */
function showNoPermission() {
  const html = `
    <div class="text-center py-12">
      <i class="fas fa-lock text-6xl text-gray-300 mb-4"></i>
      <h3 class="text-2xl font-bold text-gray-700 mb-2">ไม่มีสิทธิ์เข้าถึง</h3>
      <p class="text-gray-500">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
    </div>
  `;
  
  document.getElementById('pageContent').innerHTML = html;
  renderBreadcrumb(['ไม่มีสิทธิ์เข้าถึง']);
}

/**
 * [⭐️ ใหม่ ⭐️] ฟังก์ชันสลับการแสดง/ซ่อนรหัสผ่าน
 * @param {string} inputId - ID ของช่อง Input
 * @param {string} iconId - ID ของไอคอน (เพื่อเปลี่ยนรูปตา)
 */
function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  
  if (!input || !icon) return;

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

/**
 * ===================================
 * NOTIFICATION SYSTEM
 * ===================================
 */

// ข้อมูลจำลอง (Mock Data) - ในอนาคตเปลี่ยนไปเรียก callServerFunction('getNotifications')
let mockNotifications = [
  { id: 1, title: 'ยินดีต้อนรับ', message: 'ยินดีต้อนรับเข้าสู่ระบบ ปพ.5 ปพ.6', time: 'เมื่อสักครู่', read: false, icon: 'fas fa-smile', color: 'text-yellow-500' },
  { id: 2, title: 'ส่งเกรดวิชาภาษาไทย', message: 'อนุมัติการส่งเกรดเรียบร้อยแล้ว', time: '2 ชั่วโมงที่แล้ว', read: false, icon: 'fas fa-check-circle', color: 'text-green-500' },
  { id: 3, title: 'แจ้งเตือนระบบ', message: 'ระบบจะปิดปรับปรุงเวลา 22.00 น.', time: 'เมื่อวานนี้', read: true, icon: 'fas fa-exclamation-circle', color: 'text-red-500' }
];

function toggleNotificationDropdown() {
  const dropdown = document.getElementById('notificationDropdown');
  const isHidden = dropdown.classList.contains('hidden');
  
  // ปิด Dropdown อื่นๆ ก่อน (เช่น Profile)
  const profileDropdown = document.getElementById('profileDropdown');
  if (profileDropdown && !profileDropdown.classList.contains('hidden')) {
    profileDropdown.classList.add('hidden');
  }

  if (isHidden) {
    dropdown.classList.remove('hidden');
    renderNotifications(); // โหลดข้อมูลเมื่อเปิด
  } else {
    dropdown.classList.add('hidden');
  }
}

function renderNotifications() {
  const listContainer = document.getElementById('notificationList');
  const badge = document.getElementById('notificationCount');
  
  // 1. นับจำนวนที่ยังไม่อ่าน
  const unreadCount = mockNotifications.filter(n => !n.read).length;
  
  // 2. อัปเดต Badge
  if (unreadCount > 0) {
    badge.textContent = unreadCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
  
  // 3. สร้าง HTML รายการ
  if (mockNotifications.length === 0) {
    listContainer.innerHTML = '<div class="p-4 text-center text-gray-500 text-sm">ไม่มีการแจ้งเตือนใหม่</div>';
    return;
  }

  const html = mockNotifications.map(notif => `
    <div class="px-4 py-3 hover:bg-gray-50 border-b border-gray-100 transition-colors cursor-pointer ${notif.read ? 'opacity-60' : 'bg-blue-50/30'}">
      <div class="flex items-start space-x-3">
        <div class="flex-shrink-0 mt-1">
          <i class="${notif.icon} ${notif.color}"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-800 ${notif.read ? '' : 'font-bold'}">
            ${notif.title}
          </p>
          <p class="text-xs text-gray-600 truncate">${notif.message}</p>
          <p class="text-[10px] text-gray-400 mt-1">${notif.time}</p>
        </div>
        ${!notif.read ? `<div class="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>` : ''}
      </div>
    </div>
  `).join('');

  listContainer.innerHTML = html;
}

function markAllAsRead() {
  // อัปเดตข้อมูลจำลอง
  mockNotifications = mockNotifications.map(n => ({ ...n, read: true }));
  renderNotifications();
  showToast('อ่านทั้งหมดแล้ว', 'success');
}

/**
 * ===================================
 * 🌓 THEME MANAGEMENT (Dark Mode)
 * ===================================
 */

function initTheme() {
  // 1. ตรวจสอบค่าที่เคยบันทึกไว้ หรือค่าเริ่มต้นของเครื่อง
  const userTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (userTheme === 'dark' || (!userTheme && systemPrefersDark)) {
    document.documentElement.classList.add('dark');
    updateThemeIcon(true);
  } else {
    document.documentElement.classList.remove('dark');
    updateThemeIcon(false);
  }
}

function toggleTheme() {
  const html = document.documentElement;
  
  if (html.classList.contains('dark')) {
    html.classList.remove('dark');
    localStorage.setItem('theme', 'light');
    updateThemeIcon(false);
  } else {
    html.classList.add('dark');
    localStorage.setItem('theme', 'dark');
    updateThemeIcon(true);
  }
}

function updateThemeIcon(isDark) {
  const icon = document.getElementById('themeIcon');
  if (icon) {
    // ลบ class เก่าออกให้หมดก่อนกันพลาด
    icon.className = ''; 
    
    if (isDark) {
      // โหมดมืด: แสดงพระอาทิตย์สีเหลือง
      icon.className = 'fas fa-sun text-xl text-yellow-400';
    } else {
      // โหมดสว่าง: แสดงพระจันทร์สีเทา
      icon.className = 'fas fa-moon text-xl';
    }
  }
}

// เรียกใช้ทันทีเมื่อโหลดไฟล์
initTheme();

// เพิ่ม Listener เพื่อปิด Dropdown เมื่อคลิกที่อื่น (ใส่รวมกับของ Profile Dropdown เดิมได้)
window.addEventListener('click', (e) => {
  const notifDropdown = document.getElementById('notificationDropdown');
  const notifBtn = document.querySelector('[onclick="toggleNotificationDropdown()"]');
  
  if (notifDropdown && !notifDropdown.classList.contains('hidden')) {
    if (!notifBtn.contains(e.target) && !notifDropdown.contains(e.target)) {
      notifDropdown.classList.add('hidden');
    }
  }
});


// ===================================
// ERROR HANDLING
// ===================================

/**
 * Global Error Handler
 */
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  // สามารถส่ง error ไปยัง server เพื่อบันทึกได้
});

/**
 * Handle Unhandled Promise Rejection
 */
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // สามารถส่ง error ไปยัง server เพื่อบันทึกได้
});

// ===================================
// NETWORK STATUS MONITOR
// ===================================

window.addEventListener('online', () => {
  showToast('เชื่อมต่ออินเทอร์เน็ตแล้ว', 'success');
});

window.addEventListener('offline', () => {
  showToast('ไม่มีการเชื่อมต่ออินเทอร์เน็ต', 'warning', 5000);
});

console.log('✅ JS-Main loaded successfully');
