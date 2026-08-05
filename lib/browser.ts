/**
 * WHAT THE PAGE IS BEING VIEWED IN.
 *
 * Pure, so it can be tested against real user-agent strings rather than
 * guessed at.
 *
 * WHY THIS EXISTS. A studio's customers arrive from Instagram and Facebook
 * links, and those apps open pages in their own embedded webview rather than
 * in Safari or Chrome. `signInWithPopup` cannot complete there — the webview
 * either refuses `window.open` outright or opens a view that can never post
 * back to its opener. Firebase reports it as `auth/popup-blocked`, and the
 * product answered "Allow pop-ups for AutoModz, then try again."
 *
 * That instruction is impossible to follow inside an in-app browser: there is
 * no pop-up setting to change. The customer is told to do something that
 * cannot be done, which reads as the app being broken. Knowing WHERE we are is
 * what lets the failure say something true instead.
 */

/**
 * An embedded webview that cannot complete a sign-in pop-up.
 *
 * Deliberately narrow. iOS `SFSafariViewController` — what WhatsApp and most
 * apps use on iOS — is a real Safari and handles pop-ups fine, so it is NOT
 * matched here; matching it would send people out of the app for no reason.
 * These are the webviews that genuinely cannot do it:
 *
 *   Instagram   `Instagram`
 *   Facebook    `FBAN` / `FBAV` / `FB_IAB`
 *   Messenger   `FBAN` too
 *   Snapchat    `Snapchat`
 *   LinkedIn    `LinkedInApp`
 *   TikTok      `musical_ly` / `BytedanceWebview`
 *   Line        `Line/`
 */
const IN_APP = /(Instagram|FBAN|FBAV|FB_IAB|Snapchat|LinkedInApp|musical_ly|BytedanceWebview|Line\/)/i;

export const isInAppBrowser = (ua: string | undefined | null): boolean =>
  typeof ua === 'string' && IN_APP.test(ua);

/** The browser a customer is actually holding, when there is one to ask. */
export const currentUserAgent = (): string =>
  (typeof navigator === 'undefined' ? '' : navigator.userAgent);
