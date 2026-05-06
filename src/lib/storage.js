// Safe localStorage wrapper — mobile browsers in private mode throw SecurityError on localStorage access

export const safeStorage = {
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // silently ignore — storage unavailable
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // silently ignore
    }
  }
};