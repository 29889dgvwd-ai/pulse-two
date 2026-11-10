/* Deep-link handling for guest rooms. No registration or passwords. */
export const ROOM_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;
export function readInviteCode(url) {
  try {
    const value = new URL(url).searchParams.get('room');
    if (!value) return null;
    const normalized = value.trim().toUpperCase();
    return ROOM_PATTERN.test(normalized) ? normalized : null;
  } catch { return null; }
}
export function chooseJoinPayload({pending, invitation, session, clientId}) {
  if (pending) return pending;
  // An incoming invitation ALWAYS takes precedence over an old room session.
  const room = invitation || session?.room;
  if (!room || !session?.name || !ROOM_PATTERN.test(room)) return null;
  return {type:'join-room', room, name:session.name, clientId};
}
export function buildInviteUrl(baseUrl, room) {
  if (!ROOM_PATTERN.test(room)) throw new Error('Invalid room code');
  const url = new URL(baseUrl);
  url.searchParams.set('room', room);
  url.hash = '';
  return url.toString();
}
