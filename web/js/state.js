// Ilovaning umumiy holati.

import { loadSettings } from "./store.js";

export const S = {
  chats: [],
  cur: null,
  settings: loadSettings(),
  health: null,
  running: false,
  ctrl: null,
  pending: [], // yuborilmagan biriktirmalar
  mode: "auto", // auto | chat | image | video
  generative: false, // video: generativ model (Replicate) ishlatilsinmi
};

export const current = () => S.chats.find((c) => c.id === S.cur) || null;
