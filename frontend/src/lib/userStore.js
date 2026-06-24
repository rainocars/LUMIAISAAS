// Tiny user store backed by localStorage so login state survives navigation.
const KEY = "lumi.user.v1";

export function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (typeof window === "undefined") return;
  if (user) localStorage.setItem(KEY, JSON.stringify(user));
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("lumi-user-change"));
}

import { useEffect, useState } from "react";

export function useUser() {
  const [user, setUser] = useState(() => getStoredUser());
  useEffect(() => {
    const on = () => setUser(getStoredUser());
    window.addEventListener("lumi-user-change", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("lumi-user-change", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return [user, (u) => setStoredUser(u)];
}
