/**
 * ===================================
 * UTILITY FUNCTIONS & CORE SYSTEM
 * ===================================
 */

// ===================================
// 1. CORE SYSTEM (API & UI)
// ===================================

/**
 * เรียก API PHP (Fetch Wrapper)
 */
async function callServerFunction(functionName, ...args) {
  const url = `api.php?action=${functionName}`;
  let bodyData = {};

  // Mapping Arguments ให้ตรงกับที่ PHP (api.php) คาดหวัง
  if (args.length > 0) {
      switch (functionName) {
          // Auth
          case 'login': bodyData = { username: args[0], password: args[1] }; break;
          case 'loginStudent': bodyData = { studentId: args[0], idCard: args[1] }; break;
          case 'changePassword': bodyData = { oldPassword: args[0], newPassword: args[1] }; break;
          
          // CRUD (Single Object Argument)
          case 'createStudent': case 'createClass': case 'createUser': 
          case 'saveScores': case 'updateConfig': case 'saveOrUpdateBehavior':
          case 'saveOrUpdateActivity': case 'saveOrUpdateReading': case 'saveTimetableSlot':
              bodyData = args[0]; break;
              
          // Update (ID + Data)
          case 'updateStudent': case 'updateClass': case 'updateUser': case 'updateSubject':
              bodyData = { ...args[1], id: args[0] }; break;
              
          // Delete (ID Only)
          case 'deleteStudent': case 'deleteClass': case 'deleteUser': 
          case 'deleteSubject': case 'deleteTimetableSlot':
              bodyData = { id: args[0] }; break;
              
          // Reports & Data Fetching (Specific Mappings)
          case 'getScoresForEntry':
              bodyData = { classId: args[0], subjectId: args[1], semester: args[2], year: args[3] }; break;
          case 'getStudentGradeReport':
              bodyData = { studentId: args[0], year: args[1], semester: args[2] }; break;
          case 'getAttendanceData':
              bodyData = { classId: args[0], date: args[1] }; break;
          case 'getActivityData': case 'getBehaviorData': case 'getReadingData':
              bodyData = { classId: args[0], semester: args[1], year: args[2] }; break;
          case 'getPP5ReportData':
              bodyData = { studentId: args[0], year: args[1] }; break;
          case 'getStudentListReportData':
              bodyData = args[0]; break; // filters object
          case 'getGradeSummaryReportData':
              bodyData = args[0]; break; // filters object
          case 'getAttendanceReportData':
              bodyData = args[0]; break; // filters object
          
          // Batch Operations
          case 'batchSaveScores':
              bodyData = { 
                  subjectId: args[0], classId: args[1], semester: args[2], year: args[3], 
                  studentScores: args[4], courseworkRatio: args[5], finalRatio: args[6] 
              }; break;
          case 'batchSaveAttendance':
              bodyData = { classId: args[0], date: args[1], records: args[2] }; break;
          case 'batchMoveStudents':
              bodyData = { studentIds: args[0], targetClassId: args[1] }; break;
          case 'batchUpdateTeacherAssignments':
              bodyData = { teacherId: args[0], teacherName: args[1], subjectIds: args[2] }; break;
          case 'batchCreateStudents':
              bodyData = args[0]; break; // array of students

          // Timetable
          case 'getTimetable':
              bodyData = { teacherId: args[0], year: args[1], semester: args[2] }; break;
          case 'getAllTimetableSlots':
              bodyData = { year: args[0], semester: args[1] }; break;
          
          // Subjects Indicators
          case 'addIndicatorToSubject':
               bodyData = { subjectId: args[0], name: args[1], max: args[2], semester: args[3] }; break;
          case 'updateIndicatorInSubject':
               bodyData = { subjectId: args[0], indicatorId: args[1], name: args[2], max: args[3], semester: args[4] }; break;
          case 'deleteIndicatorFromSubject':
               bodyData = { subjectId: args[0], indicatorId: args[1], semester: args[2] }; break;

          default:
              // Fallback
              bodyData = (typeof args[0] === 'object') ? args[0] : { arg1: args[0] };
      }
  }

  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyData)
  };

  // GET method for no-arg functions (like getClasses)
  if (functionName.startsWith('get') && args.length === 0) {
      delete options.body;
      options.method = 'GET';
  }

  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let result;
    try {
        result = JSON.parse(text);
    } catch (e) {
        console.error("Raw Server Response:", text);
        return { success: false, message: "Server Error: " + text.substring(0, 100) };
    }

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    if (result.message === 'Session หมดอายุ') {
        // ถ้า Session หมดอายุ ให้จัดการที่ main controller (หรือ reload)
        localStorage.removeItem('sessionToken');
        window.location.reload();
        throw new Error(result.message);
    }
    return result;
  } catch (error) {
    console.error(`Error calling ${functionName}:`, error);
    return { success: false, message: error.message };
  }
}

/**
 * แสดง Loading Overlay
 */
function showLoading(text = 'กำลังประมวลผล...') {
    const loader = document.getElementById('loadingOverlay');
    const title = document.getElementById('loadingTitle');
    if(title) title.textContent = text;
    if(loader) {
        loader.classList.remove('hidden', 'loader-hidden');
    }
}

/**
 * ซ่อน Loading Overlay
 */
function hideLoading() {
    const loader = document.getElementById('loadingOverlay');
    if(loader) loader.classList.add('loader-hidden');
}

/**
 * เรียก Server แล้วรอผล (พร้อมแสดง Loading และ Error Handling)
 */
async function waitForResponse(serverCall, loadingMessage, onSuccess = null, onError = null) {
  showLoading(loadingMessage);
  
  try {
    // serverCall เป็น function ที่ return Promise
    const result = await serverCall();
    
    if (Array.isArray(result)) {
        // กรณี Promise.all
        if (onSuccess) onSuccess(result);
    } else if (result && result.success) {
        if (onSuccess) onSuccess(result);
    } else {
        console.error('Server error:', result.message);
        if (onError) onError(result);
        showToast('เกิดข้อผิดพลาด: ' + (result.message || 'Unknown error'), 'error');
    }
    
  } catch (error) {
    console.error('Network error:', error);
    if (onError) onError(error);
    showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

/**
 * แสดง Toast Notification (แก้ไข Bug Stack Overflow แล้ว)
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
    
    const iconClass = icons[type] || icons.info;
    const colorClass = colors[type] || colors.info;

    const html = `
        <div id="${toastId}" class="toast-enter ${colorClass} text-white px-6 py-4 rounded-lg shadow-lg flex items-center space-x-3 min-w-[300px] mb-2 transition-all duration-300">
            <i class="${iconClass} text-xl"></i>
            <span class="flex-1 font-medium">${message}</span>
            <button onclick="removeToast('${toastId}')" class="text-white hover:text-gray-200 focus:outline-none">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    const container = document.getElementById('toastContainer');
    if (container) {
        container.insertAdjacentHTML('beforeend', html);
        setTimeout(() => { removeToast(toastId); }, duration);
    } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
        alert(message);
    }
}

function removeToast(toastId) {
    const toast = document.getElementById(toastId);
    if (toast) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }
}

// ===================================
// 2. DATE & TIME UTILITIES
// ===================================

function formatThaiDate(date, showTime = false) {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  
  const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const day = d.getDate();
  const month = thaiMonths[d.getMonth()];
  const year = d.getFullYear() + 543;
  
  let result = `${day} ${month} ${year}`;
  if (showTime) {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    result += ` ${hours}:${minutes} น.`;
  }
  return result;
}

function formatDateISO(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function thaiDateToISO(thaiYear, month, day) {
  const adYear = parseInt(thaiYear) - 543;
  return `${adYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function calculateAge(birthdate) {
  if (!birthdate) return 0;
  const birth = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function timeAgo(date) {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const seconds = Math.floor((now - d) / 1000);
  
  const intervals = { 'ปี': 31536000, 'เดือน': 2592000, 'สัปดาห์': 604800, 'วัน': 86400, 'ชั่วโมง': 3600, 'นาที': 60, 'วินาที': 1 };
  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) return `${interval} ${unit}ที่แล้ว`;
  }
  return 'เมื่อสักครู่';
}

// ===================================
// 3. NUMBER & STRING UTILITIES
// ===================================

function formatNumber(num, decimals = 0) {
  if (num === null || num === undefined || isNaN(num)) return '-';
  return parseFloat(num).toFixed(decimals);
}

function formatScore(score) { return formatNumber(score, 2); }
function formatGPA(gpa) { return formatNumber(gpa, 2); }

function formatPercent(value, total) {
  if (!total || total === 0) return '0%';
  return formatNumber((value / total) * 100, 1) + '%';
}

function validateStudentCode(code) {
  return code && /^\d{5,10}$/.test(code);
}

function validateIDCard(idCard) {
  if (!idCard || idCard.length !== 13 || !/^\d{13}$/.test(idCard)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(idCard[i]) * (13 - i);
  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === parseInt(idCard[12]);
}

function validateEmail(email) {
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
  return phone && /^(0\d{8,9}|0\d-\d{7,8})$/.test(phone.replace(/[\s-]/g, ''));
}

function validateScore(score) {
  return typeof score === 'number' && score >= 0 && score <= 100;
}

function truncate(text, length = 50) {
  if (!text) return '';
  return text.length <= length ? text : text.substring(0, length) + '...';
}

function capitalize(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function camelToWords(text) {
  if (!text) return '';
  return text.replace(/([A-Z])/g, ' $1').trim();
}

function getInitials(name) {
  if (!name) return '';
  const words = name.split(' ');
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return words[0].charAt(0).toUpperCase() + words[words.length - 1].charAt(0).toUpperCase();
}

// ===================================
// 4. GRADE & LOGIC UTILITIES
// ===================================

function calculateTotalScore(scores, weights) {
  let total = 0;
  const fields = ['assignment', 'worksheet', 'participation', 'project', 'quiz1', 'quiz2', 'midterm', 'final'];
  for (const field of fields) {
    const score = scores[field] || 0;
    const weight = weights[field] || 0;
    total += (score * weight) / 100;
  }
  return Math.round(total * 100) / 100;
}

function getGradeFromScore(score) {
  const criteria = [
    { grade: '4', text: 'ดีเยี่ยม', min_score: 80, max_score: 100, gpa_value: 4.0, status: 'ผ่าน' },
    { grade: '3.5', text: 'ดีมาก', min_score: 75, max_score: 79, gpa_value: 3.5, status: 'ผ่าน' },
    { grade: '3', text: 'ดี', min_score: 70, max_score: 74, gpa_value: 3.0, status: 'ผ่าน' },
    { grade: '2.5', text: 'ค่อนข้างดี', min_score: 65, max_score: 69, gpa_value: 2.5, status: 'ผ่าน' },
    { grade: '2', text: 'ปานกลาง', min_score: 60, max_score: 64, gpa_value: 2.0, status: 'ผ่าน' },
    { grade: '1.5', text: 'พอใช้', min_score: 55, max_score: 59, gpa_value: 1.5, status: 'ผ่าน' },
    { grade: '1', text: 'ปรับปรุง', min_score: 50, max_score: 54, gpa_value: 1.0, status: 'ผ่าน' },
    { grade: '0', text: 'ไม่ผ่านเกณฑ์', min_score: 0, max_score: 49, gpa_value: 0, status: 'ไม่ผ่าน' }
  ];
  for (const criterion of criteria) {
    if (score >= criterion.min_score && score <= criterion.max_score) return criterion;
  }
  return criteria[criteria.length - 1];
}

function calculateGPA(scores) {
  if (!scores || scores.length === 0) return 0;
  let totalGPA = 0;
  let totalCredit = 0;
  for (const score of scores) {
    const credit = score.subject_credit || 1;
    totalGPA += (score.gpa_value || 0) * credit;
    totalCredit += credit;
  }
  return totalCredit === 0 ? 0 : Math.round((totalGPA / totalCredit) * 100) / 100;
}

// ===================================
// 5. ARRAY & STORAGE UTILITIES
// ===================================

/**
 * เรียงลำดับ Array (Safe Sort - แก้ไข localeCompare error)
 */
function sortArray(array, field, order = 'asc') {
  if (!array || array.length === 0) return [];
  
  return [...array].sort((a, b) => {
    const aVal = (a[field] === null || a[field] === undefined) ? '' : String(a[field]);
    const bVal = (b[field] === null || b[field] === undefined) ? '' : String(b[field]);
    
    const cmp = aVal.localeCompare(bVal, 'th', { numeric: true });
    return order === 'asc' ? cmp : -cmp;
  });
}

function filterArray(array, query, fields) {
  if (!array || array.length === 0) return [];
  if (!query) return array;
  const lowerQuery = query.toLowerCase();
  return array.filter(item => fields.some(field => String(item[field] || '').toLowerCase().includes(lowerQuery)));
}

function paginateArray(array, page = 1, pageSize = 20) {
  if (!array || array.length === 0) return { data: [], total: 0, page: 1, pageSize, totalPages: 0 };
  const total = array.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  return {
    data: array.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages
  };
}

function randomColor() {
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#ef4444'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function getGradeColor(grade) {
  const g = parseFloat(grade);
  if (g >= 4) return 'text-green-600 bg-green-100';
  if (g >= 3) return 'text-blue-600 bg-blue-100';
  if (g >= 2) return 'text-yellow-600 bg-yellow-100';
  if (g >= 1) return 'text-orange-600 bg-orange-100';
  return 'text-red-600 bg-red-100';
}

function getStatusColor(status) {
  const colors = {
    'active': 'badge-success', 'inactive': 'badge-secondary', 'present': 'badge-success',
    'absent': 'badge-danger', 'late': 'badge-warning', 'leave': 'badge-info',
    'passed': 'badge-success', 'failed': 'badge-danger', 'ผ่าน': 'badge-success',
    'ไม่ผ่าน': 'badge-danger', 'locked': 'badge-secondary'
  };
  return colors[status] || 'badge-secondary';
}

function debounce(func, wait = 300) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

function throttle(func, limit = 300) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

function exportToCSV(data, filename) {
  if (!data || data.length === 0) return showToast('ไม่มีข้อมูลให้ Export', 'warning');
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => `"${String(row[h]).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${formatDateISO(new Date())}.csv`;
  link.click();
  showToast('Export CSV สำเร็จ', 'success');
}

function printPage() { window.print(); }

function saveToStorage(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.error(e); } }
function getFromStorage(key) { try { const i = localStorage.getItem(key); return i ? JSON.parse(i) : null; } catch (e) { console.error(e); return null; } }
function removeFromStorage(key) { try { localStorage.removeItem(key); } catch (e) { console.error(e); } }

function parseCSV(text) {
  try {
    const lines = text.trim().split(/\r\n|\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const result = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i]) continue;
      const values = lines[i].split(',');
      if (values.length !== headers.length) continue;
      const obj = {};
      for (let j = 0; j < headers.length; j++) obj[headers[j]] = (values[j] || '').trim().replace(/"/g, '');
      result.push(obj);
    }
    return result;
  } catch (error) {
    console.error('Error parsing CSV:', error);
    showToast('เกิดข้อผิดพลาดในการอ่านไฟล์ CSV', 'error');
    return [];
  }
}

console.log('✅ JS-Utils (Complete & Safe) loaded successfully');