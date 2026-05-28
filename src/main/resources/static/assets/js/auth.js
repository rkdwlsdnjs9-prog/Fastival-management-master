// Authentication Module for Temporary Staff Credentials
import { DB, addNotification } from './store.js';

export function getCurrentUser() {
  const userJson = sessionStorage.getItem("STAFF_CURRENT_USER");
  return userJson ? JSON.parse(userJson) : null;
}

export function login(id, pw) {
  const staff = DB.staffs.find(s => s.id === id && s.pw === pw);
  if (staff) {
    sessionStorage.setItem("STAFF_CURRENT_USER", JSON.stringify(staff));
    addNotification("AUTH", `[로그인 성공] ${staff.name} 계정으로 로그인했습니다.`);
    return { success: true, user: staff };
  }
  return { success: false, error: "아이디 또는 비밀번호가 올바르지 않습니다." };
}

export function logout() {
  const currentUser = getCurrentUser();
  if (currentUser) {
    addNotification("AUTH", `[로그아웃 완료] ${currentUser.name} 계정이 안전하게 로그아웃되었습니다.`);
  }
  sessionStorage.removeItem("STAFF_CURRENT_USER");
}

export function getStaffList() {
  return DB.staffs;
}

// Generate a random temporary account
export function generateTemporaryAccount() {
  const suffix = Math.floor(100 + Math.random() * 900);
  const tempId = `temp${suffix}`;
  const tempPw = `pass${suffix}`;
  const newAccount = {
    id: tempId,
    pw: tempPw,
    name: `임시 스태프 #${suffix}`
  };
  
  DB.staffs.push(newAccount);
  addNotification("AUTH", `[임시 계정 생성] 아이디: ${tempId} / 비밀번호: ${tempPw}`);
  // Save to persistence
  import('./store.js').then(module => {
    module.saveDB();
  });
  return newAccount;
}
