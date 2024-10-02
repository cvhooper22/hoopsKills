export function getStorageItem (key) {
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    console.error(err);
  }
}

export function setStorageItem () {
  try {
    return window.localStorage.setItem(key, value);
  } catch (err) {
    console.error(err);
  }
}