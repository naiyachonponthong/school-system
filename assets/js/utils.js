
/**
 * ===================================
 * UTILITY FUNCTIONS
 * ===================================
 */

// ===================================
// DATE & TIME UTILITIES
// ===================================

/**
 * จัดรูปแบบวันที่เป็นภาษาไทย
 * @param {string|Date} date - วันที่
 * @param {boolean} showTime - แสดงเวลาหรือไม่
 * @returns {string} วันที่ที่จัดรูปแบบแล้ว
 */
function formatThaiDate(date, showTime = false) {
  if (!date) return '-';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  
  const day = d.getDate();
  const month = thaiMonths[d.getMonth()];
  const year = d.getFullYear() + 543; // แปลงเป็น พ.ศ.
  
  let result = `${day} ${month} ${year}`;
  
  if (showTime) {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    result += ` ${hours}:${minutes} น.`;
  }
  
  return result;
}

/**
 * จัดรูปแบบวันที่เป็น YYYY-MM-DD
 * @param {Date} date - วันที่
 * @returns {string} วันที่ในรูปแบบ YYYY-MM-DD
 */
function formatDateISO(date) {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * แปลงวันที่ไทยเป็น ISO
 * @param {string} thaiYear - ปี พ.ศ.
 * @param {string} month - เดือน
 * @param {string} day - วัน
 * @returns {string} วันที่ ISO
 */
function thaiDateToISO(thaiYear, month, day) {
  const adYear = parseInt(thaiYear) - 543;
  return `${adYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * คำนวณอายุจากวันเกิด
 * @param {string} birthdate - วันเกิด
 * @returns {number} อายุ
 */
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

/**
 * แสดงเวลาแบบสัมพัทธ์ (เช่น 5 นาทีที่แล้ว)
 * @param {string|Date} date - วันที่
 * @returns {string} เวลาแบบสัมพัทธ์
 */
function timeAgo(date) {
  if (!date) return '-';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const seconds = Math.floor((now - d) / 1000);
  
  const intervals = {
    'ปี': 31536000,
    'เดือน': 2592000,
    'สัปดาห์': 604800,
    'วัน': 86400,
    'ชั่วโมง': 3600,
    'นาที': 60,
    'วินาที': 1
  };
  
  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}ที่แล้ว`;
    }
  }
  
  return 'เมื่อสักครู่';
}

// ===================================
// NUMBER UTILITIES
// ===================================

/**
 * จัดรูปแบบตัวเลข
 * @param {number} num - ตัวเลข
 * @param {number} decimals - จำนวนทศนิยม
 * @returns {string} ตัวเลขที่จัดรูปแบบแล้ว
 */
function formatNumber(num, decimals = 0) {
  if (num === null || num === undefined || isNaN(num)) return '-';
  return parseFloat(num).toFixed(decimals);
}

/**
 * จัดรูปแบบคะแนน
 * @param {number} score - คะแนน
 * @returns {string} คะแนนที่จัดรูปแบบแล้ว
 */
function formatScore(score) {
  return formatNumber(score, 2);
}

/**
 * จัดรูปแบบ GPA
 * @param {number} gpa - GPA
 * @returns {string} GPA ที่จัดรูปแบบแล้ว
 */
function formatGPA(gpa) {
  return formatNumber(gpa, 2);
}

/**
 * จัดรูปแบบเปอร์เซ็นต์
 * @param {number} value - ค่า
 * @param {number} total - ค่ารวม
 * @returns {string} เปอร์เซ็นต์
 */
function formatPercent(value, total) {
  if (!total || total === 0) return '0%';
  const percent = (value / total) * 100;
  return formatNumber(percent, 1) + '%';
}

// ===================================
// VALIDATION UTILITIES
// ===================================

/**
 * ตรวจสอบรหัสนักเรียน
 * @param {string} code - รหัสนักเรียน
 * @returns {boolean} ถูกต้องหรือไม่
 */
function validateStudentCode(code) {
  if (!code) return false;
  // รูปแบบ: ตัวเลข 5-10 หลัก
  return /^\d{5,10}$/.test(code);
}

/**
 * ตรวจสอบเลขบัตรประชาชน
 * @param {string} idCard - เลขบัตรประชาชน
 * @returns {boolean} ถูกต้องหรือไม่
 */
function validateIDCard(idCard) {
  if (!idCard || idCard.length !== 13) return false;
  
  // ตรวจสอบว่าเป็นตัวเลขทั้งหมด
  if (!/^\d{13}$/.test(idCard)) return false;
  
  // ตรวจสอบด้วยอัลกอริทึม
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(idCard[i]) * (13 - i);
  }
  const checkDigit = (11 - (sum % 11)) % 10;
  
  return checkDigit === parseInt(idCard[12]);
}

/**
 * ตรวจสอบอีเมล
 * @param {string} email - อีเมล
 * @returns {boolean} ถูกต้องหรือไม่
 */
function validateEmail(email) {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * ตรวจสอบเบอร์โทรศัพท์
 * @param {string} phone - เบอร์โทรศัพท์
 * @returns {boolean} ถูกต้องหรือไม่
 */
function validatePhone(phone) {
  if (!phone) return false;
  // รูปแบบ: 0812345678 หรือ 02-1234567
  return /^(0\d{8,9}|0\d-\d{7,8})$/.test(phone.replace(/[\s-]/g, ''));
}

/**
 * ตรวจสอบคะแนน
 * @param {number} score - คะแนน
 * @returns {boolean} ถูกต้องหรือไม่
 */
function validateScore(score) {
  return typeof score === 'number' && score >= 0 && score <= 100;
}

// ===================================
// TEXT UTILITIES
// ===================================

/**
 * ตัดข้อความยาว
 * @param {string} text - ข้อความ
 * @param {number} length - ความยาวสูงสุด
 * @returns {string} ข้อความที่ตัดแล้ว
 */
function truncate(text, length = 50) {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

/**
 * แปลงตัวอักษรแรกเป็นตัวพิมพ์ใหญ่
 * @param {string} text - ข้อความ
 * @returns {string} ข้อความที่แปลงแล้ว
 */
function capitalize(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * แปลง CamelCase เป็นช่องว่าง
 * @param {string} text - ข้อความ
 * @returns {string} ข้อความที่แปลงแล้ว
 */
function camelToWords(text) {
  if (!text) return '';
  return text.replace(/([A-Z])/g, ' $1').trim();
}

/**
 * สร้างตัวย่อจากชื่อ
 * @param {string} name - ชื่อ
 * @returns {string} ตัวย่อ
 */
function getInitials(name) {
  if (!name) return '';
  const words = name.split(' ');
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return words[0].charAt(0).toUpperCase() + words[words.length - 1].charAt(0).toUpperCase();
}

// ===================================
// GRADE CALCULATION
// ===================================

/**
 * คำนวณคะแนนรวม
 * @param {Object} scores - คะแนน
 * @param {Object} weights - น้ำหนัก
 * @returns {number} คะแนนรวม
 */
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

/**
 * คำนวณเกรดจากคะแนน (Client-side preview)
 * @param {number} score - คะแนนรวม
 * @returns {Object} ข้อมูลเกรด
 */
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
    if (score >= criterion.min_score && score <= criterion.max_score) {
      return criterion;
    }
  }
  
  return criteria[criteria.length - 1];
}

/**
 * คำนวณ GPA
 * @param {Array} scores - Array ของคะแนนวิชาต่างๆ
 * @returns {number} GPA
 */
function calculateGPA(scores) {
  if (!scores || scores.length === 0) return 0;
  
  let totalGPA = 0;
  let totalCredit = 0;
  
  for (const score of scores) {
    const credit = score.subject_credit || 1;
    totalGPA += (score.gpa_value || 0) * credit;
    totalCredit += credit;
  }
  
  if (totalCredit === 0) return 0;
  
  return Math.round((totalGPA / totalCredit) * 100) / 100;
}

// ===================================
// ARRAY UTILITIES
// ===================================

/**
 * เรียงลำดับ Array
 * @param {Array} array - Array
 * @param {string} field - ฟิลด์ที่ใช้เรียง
 * @param {string} order - asc หรือ desc
 * @returns {Array} Array ที่เรียงแล้ว
 */
function sortArray(array, field, order = 'asc') {
  if (!array || array.length === 0) return [];
  
  const sorted = [...array].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];
    
    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
  
  return sorted;
}

/**
 * กรอง Array
 * @param {Array} array - Array
 * @param {string} query - คำค้นหา
 * @param {Array} fields - ฟิลด์ที่ใช้ค้นหา
 * @returns {Array} Array ที่กรองแล้ว
 */
function filterArray(array, query, fields) {
  if (!array || array.length === 0) return [];
  if (!query) return array;
  
  const lowerQuery = query.toLowerCase();
  
  return array.filter(item => {
    for (const field of fields) {
      const value = String(item[field] || '').toLowerCase();
      if (value.includes(lowerQuery)) return true;
    }
    return false;
  });
}

/**
 * Paginate Array
 * @param {Array} array - Array
 * @param {number} page - หน้า (เริ่มจาก 1)
 * @param {number} pageSize - จำนวนต่อหน้า
 * @returns {Object} ผลลัพธ์ pagination
 */
function paginateArray(array, page = 1, pageSize = 20) {
  if (!array || array.length === 0) {
    return {
      data: [],
      total: 0,
      page: 1,
      pageSize: pageSize,
      totalPages: 0
    };
  }
  
  const total = array.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const data = array.slice(start, end);
  
  return {
    data,
    total,
    page,
    pageSize,
    totalPages
  };
}

// ===================================
// COLOR UTILITIES
// ===================================

/**
 * สุ่มสี
 * @returns {string} สีในรูปแบบ hex
 */
function randomColor() {
  const colors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#06b6d4', '#6366f1', '#ef4444'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * ได้สีตามเกรด
 * @param {string} grade - เกรด
 * @returns {string} สี
 */
function getGradeColor(grade) {
  const gradeFloat = parseFloat(grade);
  
  if (gradeFloat >= 4) return 'text-green-600 bg-green-100';
  if (gradeFloat >= 3) return 'text-blue-600 bg-blue-100';
  if (gradeFloat >= 2) return 'text-yellow-600 bg-yellow-100';
  if (gradeFloat >= 1) return 'text-orange-600 bg-orange-100';
  return 'text-red-600 bg-red-100';
}

/**
 * ได้สีตามสถานะ
 * @param {string} status - สถานะ
 * @returns {string} คลาส CSS
 */
function getStatusColor(status) {
  const statusColors = {
    'active': 'badge-success',
    'inactive': 'badge-secondary',
    'present': 'badge-success',
    'absent': 'badge-danger',
    'late': 'badge-warning',
    'leave': 'badge-info',
    'passed': 'badge-success',
    'failed': 'badge-danger',
    'ผ่าน': 'badge-success',
    'ไม่ผ่าน': 'badge-danger',
    'locked': 'badge-secondary'
  };
  
  return statusColors[status] || 'badge-secondary';
}

// ===================================
// DEBOUNCE & THROTTLE
// ===================================

/**
 * Debounce function
 * @param {Function} func - ฟังก์ชัน
 * @param {number} wait - เวลารอ (ms)
 * @returns {Function} Debounced function
 */
function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 * @param {Function} func - ฟังก์ชัน
 * @param {number} limit - ขีดจำกัด (ms)
 * @returns {Function} Throttled function
 */
function throttle(func, limit = 300) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ===================================
// EXPORT UTILITIES
// ===================================

/**
 * Export เป็น CSV
 * @param {Array} data - ข้อมูล
 * @param {string} filename - ชื่อไฟล์
 */
function exportToCSV(data, filename) {
  if (!data || data.length === 0) {
    showToast('ไม่มีข้อมูลให้ Export', 'warning');
    return;
  }
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const value = row[header];
      // Escape quotes and commas
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(','))
  ].join('\n');
  
  // Add BOM for UTF-8
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${formatDateISO(new Date())}.csv`;
  link.click();
  
  showToast('Export CSV สำเร็จ', 'success');
}

/**
 * Print หน้าจอปัจจุบัน
 */
function printPage() {
  window.print();
}

// ===================================
// STORAGE UTILITIES
// ===================================

/**
 * เก็บข้อมูลใน LocalStorage
 * @param {string} key - Key
 * @param {*} value - Value
 */
function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error saving to storage:', error);
  }
}

/**
 * ดึงข้อมูลจาก LocalStorage
 * @param {string} key - Key
 * @returns {*} Value
 */
function getFromStorage(key) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error('Error getting from storage:', error);
    return null;
  }
}

/**
 * ลบข้อมูลจาก LocalStorage
 * @param {string} key - Key
 */
function removeFromStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error removing from storage:', error);
  }
}

// ===================================
// [⭐️ ใหม่ ⭐️] CSV PARSER
// ===================================

/**
 * [⭐️ ใหม่ ⭐️] แปลงข้อความ CSV เป็น Array of Objects
 * @param {string} text - ข้อความ CSV
 * @returns {Array<Object>}
 */
function parseCSV(text) {
  try {
    const lines = text.trim().split(/\r\n|\n/);
    if (lines.length < 2) return []; // ต้องมี headers และอย่างน้อย 1 แถว

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i]) continue; // ข้ามแถวว่าง
      
      // การ split แบบง่าย (ไม่รองรับ comma ใน quote)
      const values = lines[i].split(','); 
      
      if (values.length !== headers.length) {
         console.warn(`Skipping row ${i+1}: column mismatch. Expected ${headers.length}, got ${values.length}`);
         continue;
      }

      const obj = {};
      for (let j = 0; j < headers.length; j++) {
        const value = (values[j] || '').trim().replace(/"/g, '');
        
        // [⭐️⭐️⭐️ แก้ไข ⭐️⭐️⭐️]
        // แก้ไข Error `replace is not a function`
        // โดยการเก็บทุกอย่างเป็น String เสมอ
        // ไม่พยายามแปลงเป็นตัวเลข (Number)
        obj[headers[j]] = value; 
      }
      result.push(obj);
    }
    return result;
  } catch (error) {
    console.error('Error parsing CSV:', error);
    showToast('เกิดข้อผิดพลาดในการอ่านไฟล์ CSV', 'error');
    return [];
  }
}



console.log('✅ JS-Utils loaded successfully');
