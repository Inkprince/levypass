export const en = {
  "app.name": "LevyPass",
  "app.tagline": "Pay market and park levies digitally. Show one QR code to prove you paid.",
  "home.trader": "I am a trader",
  "home.officer": "I am an officer",
  "home.admin": "Revenue office",
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
