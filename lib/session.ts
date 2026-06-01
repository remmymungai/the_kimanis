"use client";

const GUEST_ID_KEY = "kimanis_guest_id";
const DISPLAY_NAME_KEY = "kimanis_display_name";

export function getStoredGuestId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(GUEST_ID_KEY);
}

export function getStoredDisplayName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(DISPLAY_NAME_KEY);
}

export function storeSession(guestId: string, displayName: string): void {
  localStorage.setItem(GUEST_ID_KEY, guestId);
  localStorage.setItem(DISPLAY_NAME_KEY, displayName);
}

export function clearSession(): void {
  localStorage.removeItem(GUEST_ID_KEY);
  localStorage.removeItem(DISPLAY_NAME_KEY);
}
