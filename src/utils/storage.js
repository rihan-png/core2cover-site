export const getStorageItem = (key) => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key) || sessionStorage.getItem(key);
};

export const setStorageItem = (key, value, rememberMe = true) => {
  if (typeof window === "undefined") return;
  if (rememberMe) {
    localStorage.setItem(key, value);
  } else {
    sessionStorage.setItem(key, value);
  }
};

export const removeStorageItem = (key) => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
};

export const clearStorage = () => {
  if (typeof window === "undefined") return;
  localStorage.clear();
  sessionStorage.clear();
};

export const getEncryptedStorageItem = (key) => {
  const item = getStorageItem(key);
  if (!item) return null;
  try {
    return atob(item);
  } catch (e) {
    console.error(`Failed to decode storage item ${key}:`, e);
    return null;
  }
};

export const setEncryptedStorageItem = (key, value, rememberMe = true) => {
  if (value === undefined || value === null) return;
  try {
    const encodedValue = btoa(String(value));
    setStorageItem(key, encodedValue, rememberMe);
  } catch (e) {
    console.error(`Failed to encode storage item ${key}:`, e);
  }
};

export const isPersistentSession = () => {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("token");
};
