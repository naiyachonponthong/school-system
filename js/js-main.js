/**
 * ===================================
 * MAIN CONTROLLER
 * (Initialization, Auth, Navigation)
 * ===================================
 */

// Global Variables
let globalNotifications = [];
window.currentUser = null;
window.currentPage = 'dashboard';
window.sessionToken = null;

// ===================================
// 1. INITIALIZATION
// ===================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 System initializing...');
  
  const sessionToken = localStorage.getItem('sessionToken');
  
  if (sessionToken) {
    showLoading('กำลังตรวจสอบเซสชัน...');
    
    // เรียกฟังก์ชันจาก js-utils.js
    callServerFunction('validateSession')
      .then(handleSessionValidation)
      .catch(error => {
          console.error(error);
          handleSessionError(error);
      });

    // Auto-refresh session ทุก 30 นาที
    setInterval(() => {
      if (localStorage.getItem('sessionToken')) {
        callServerFunction('validateSession');
      }
    }, 30 * 60 * 1000);
      
  } else {
    console.log('No token found, showing login page.');
    showLoginPage();
    hideLoading();
  }
});

// ===================================
// 2. SESSION HANDLERS
// ===================================

function handleSessionValidation(result) {
  if (result && result.success) {
    window.currentUser = result.user;
    console.log('✅ Session valid:', result.user);
    
    showMainApplication();
    
    // Render Sidebar & Navigate ตาม Role
    if (result.user.role === 'student') {
      if (typeof renderStudentSidebar === 'function') {
          renderStudentSidebar();
          navigateTo('studentGrades');
      }
    } else {
      if (typeof renderSidebar === 'function') {
          renderSidebar(result.user.role);
          navigateTo('dashboard');
      }
    }
  } else {
    handleSessionError(new Error(result ? result.message : 'Session invalid'));
  }
  hideLoading();
}

function handleSessionError(error) {
  console.warn('❌ Session Error:', error.message);
  localStorage.removeItem('sessionToken');
  window.sessionToken = null;
  window.currentUser = null;
  showLoginPage();
  hideLoading();
}

// ===================================
// 3. LOGIN / LOGOUT HANDLERS
// ===================================

async function handleTeacherLogin(event) {
  event.preventDefault();
  const username = document.getElementById('teacher_username').value.trim();
  const password = document.getElementById('teacher_password').value;
  
  if (!username || !password) {
    showToast('กรุณากรอก Username และ Password', 'warning');
    return;
  }
  
  showLoading('กำลังเข้าสู่ระบบ...');
  const result = await callServerFunction('login', username, password);
  
  if (result.success) {
      localStorage.setItem('sessionToken', result.sessionToken);
      handleSessionValidation(result);
      showToast('เข้าสู่ระบบสำเร็จ', 'success');
  } else {
      showToast(result.message, 'error');
      hideLoading();
  }
}

async function handleStudentLogin(event) {
  event.preventDefault();
  const studentId = document.getElementById('student_id').value.trim();
  const idCard = document.getElementById('student_id_card').value.trim();
  
  if (!studentId || !idCard) {
    showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'warning');
    return;
  }
  
  showLoading('กำลังเข้าสู่ระบบ...');
  const result = await callServerFunction('loginStudent', studentId, idCard);
  
  if (result.success) {
      localStorage.setItem('sessionToken', result.sessionToken);
      handleSessionValidation(result);
      showToast('เข้าสู่ระบบสำเร็จ', 'success');
  } else {
      showToast(result.message, 'error');
      hideLoading();
  }
}

function handleLogout() {
  showConfirmModal('ยืนยันการออกจากระบบ', 'คุณต้องการออกจากระบบใช่หรือไม่?', () => {
      showLoading('กำลังออกจากระบบ...');
      callServerFunction('logout'); // Fire and forget
      localStorage.removeItem('sessionToken');
      window.sessionToken = null;
      window.currentUser = null;
      window.location.reload();
      
  }, { confirmText: 'ออกจากระบบ', confirmColor: 'red', icon: 'fas fa-sign-out-alt' });
}

// ===================================
// 4. NAVIGATION & UI CONTROLLERS
// ===================================

function navigateTo(page) {
  window.currentPage = page;
  
  document.querySelectorAll('.sidebar-link').forEach(item => item.classList.remove('active'));
  const activeLink = document.querySelector(`.sidebar-link[data-page="${page}"]`);
  
  if (activeLink) {
      activeLink.classList.add('active');
      const parentSubmenu = activeLink.closest('.sidebar-submenu');
      if (parentSubmenu) {
          parentSubmenu.classList.remove('hidden');
          const groupId = parentSubmenu.id.replace('submenu-', '');
          const groupBtn = document.querySelector(`.sidebar-group[data-group-id="${groupId}"]`);
          if(groupBtn) {
              groupBtn.classList.add('open');
              const arrow = groupBtn.querySelector('.fa-chevron-down');
              if(arrow) arrow.classList.add('rotate-180');
          }
      }
  }

  if (window.innerWidth < 768) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
      toggleSidebar();
    }
  }

  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'students': renderStudentsPage(); break;
    case 'classes': renderClassesPage(); break;
    case 'assign-subjects': renderAssignSubjectsPage(); break;
    case 'subjects-crud': renderSubjectsCrudPage(); break;
    case 'scores': renderScoresPage(); break;
    case 'grades-view': renderGradesViewPage(); break;
    case 'behaviors': renderBehaviorsPage(); break;
    case 'activities': renderActivitiesPage(); break;
    case 'reading': renderReadingSelectionPage(); break;
    case 'attendance': renderAttendancePage(); break;
    case 'timetable': renderTimetablePage(); break;
    case 'pp5': renderPP5Page(); break;
    case 'pp6': renderPP6Page(); break;
    case 'reports': renderReportsPage(); break;
    case 'users': renderUsersPage(); break;
    case 'studentGrades': renderStudentGradesPage(); break;
    case 'studentAttendance': renderStudentAttendancePage(); break;
    case 'studentTimetable': renderStudentTimetablePage(); break;
    case 'settings': renderSettingsPage(); break;
    case 'profile': renderProfilePage(); break;
    default: renderDashboard();
  }
  window.scrollTo(0, 0);
}

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
  } else {
    teacherForms.forEach(el => el.classList.add('hidden'));
    studentForms.forEach(el => el.classList.remove('hidden'));
    studentTab.classList.add('active', 'bg-white', 'text-blue-600');
    studentTab.classList.remove('text-gray-600');
    teacherTab.classList.remove('active', 'bg-white', 'text-blue-600');
    teacherTab.classList.add('text-gray-600');
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const contentArea = document.getElementById('contentArea');
  const icon = document.getElementById('sidebarToggleIcon');
  
  const isMobile = window.innerWidth < 768;
  
  if (isMobile) {
    if (sidebar.classList.contains('-translate-x-full')) {
      sidebar.classList.remove('-translate-x-full');
      sidebar.classList.add('translate-x-0');
      overlay.classList.remove('hidden');
    } else {
      sidebar.classList.remove('translate-x-0');
      sidebar.classList.add('-translate-x-full');
      overlay.classList.add('hidden');
    }
  } else {
    if (sidebar.classList.contains('sidebar-mini')) {
      sidebar.classList.remove('sidebar-mini');
      contentArea.classList.remove('md:ml-20');
      contentArea.classList.add('md:ml-64');
      if(icon) { icon.classList.remove('fa-arrow-right'); icon.classList.add('fa-arrow-left'); }
    } else {
      sidebar.classList.add('sidebar-mini');
      contentArea.classList.remove('md:ml-64');
      contentArea.classList.add('md:ml-20');
      if(icon) { icon.classList.remove('fa-arrow-left'); icon.classList.add('fa-arrow-right'); }
    }
  }
}

function toggleProfileDropdown() {
  const dropdown = document.getElementById('profileDropdown');
  if (dropdown) dropdown.classList.toggle('hidden');
}

function toggleNotificationDropdown() {
  const dropdown = document.getElementById('notificationDropdown');
  if (dropdown) dropdown.classList.toggle('hidden');
}

window.addEventListener('click', (e) => {
  const profDropdown = document.getElementById('profileDropdown');
  const profBtn = document.querySelector('[onclick="toggleProfileDropdown()"]');
  if (profDropdown && !profDropdown.classList.contains('hidden')) {
    if (profBtn && !profBtn.contains(e.target) && !profDropdown.contains(e.target)) {
      profDropdown.classList.add('hidden');
    }
  }

  const notifDropdown = document.getElementById('notificationDropdown');
  const notifBtn = document.querySelector('[onclick="toggleNotificationDropdown()"]');
  if (notifDropdown && !notifDropdown.classList.contains('hidden')) {
    if (notifBtn && !notifBtn.contains(e.target) && !notifDropdown.contains(e.target)) {
      notifDropdown.classList.add('hidden');
    }
  }
});

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

function showLoginPage() {
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('mainApp').classList.add('hidden');
}

function showMainApplication() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  updateNavbarAvatar();
}

function updateNavbarAvatar() {
  const avatarContainer = document.getElementById('navUserAvatar');
  if (!avatarContainer || !window.currentUser) return;

  const nameEl = document.getElementById('userName');
  const roleEl = document.getElementById('userRole');
  if(nameEl) nameEl.textContent = window.currentUser.name;
  if(roleEl) roleEl.textContent = getRoleLabel(window.currentUser.role);

  const photoUrl = window.currentUser.photo_url;
  const initial = getInitials(window.currentUser.name);
  
  avatarContainer.innerHTML = '';
  if (photoUrl && photoUrl.trim() !== '') {
    avatarContainer.classList.remove('bg-gradient-to-br', 'from-blue-500', 'to-purple-600');
    avatarContainer.innerHTML = `<img src="${photoUrl}" class="w-full h-full object-cover rounded-full">`;
  } else {
    avatarContainer.classList.add('bg-gradient-to-br', 'from-blue-500', 'to-purple-600');
    avatarContainer.innerHTML = `<span id="userInitial">${initial}</span>`;
  }
}

if(localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark');
}

console.log('✅ JS-Main (Clean) loaded successfully');