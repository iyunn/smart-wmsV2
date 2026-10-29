// Konstanta auth tanpa import apa pun — aman dipakai di proxy.ts, server, dan test.

export const SESSION_COOKIE = "smartwms_session";

/** Token sesi: 32 byte acak dalam base64url = 43 karakter. */
export const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
