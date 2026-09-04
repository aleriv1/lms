const t = {
  primary: "#2457d6", primaryHover: "#1d46ad", danger: "#c22e35",
  dangerHover: "#9f252b", text: "#172033", textMuted: "#5b6475",
  surface: "#ffffff", subtle: "#f4f6fa", border: "#cbd1dc", focus: "#2457d6",
};
const lum = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const cr = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const pairs = [
  ["текст на карточке", t.text, t.surface, 4.5],
  ["текст на подложке", t.text, t.subtle, 4.5],
  ["приглушённый текст на карточке", t.textMuted, t.surface, 4.5],
  ["приглушённый текст на подложке", t.textMuted, t.subtle, 4.5],
  ["ссылка/акцент на карточке", t.primary, t.surface, 4.5],
  ["ссылка/акцент на подложке", t.primary, t.subtle, 4.5],
  ["белый на кнопке primary", t.surface, t.primary, 4.5],
  ["белый на primary:hover", t.surface, t.primaryHover, 4.5],
  ["ошибка на карточке", t.danger, t.surface, 4.5],
  ["ошибка на подложке", t.danger, t.subtle, 4.5],
  ["белый на кнопке danger", t.surface, t.danger, 4.5],
  ["белый на danger:hover", t.surface, t.dangerHover, 4.5],
  ["граница поля на карточке (UI 3:1)", t.border, t.surface, 3],
  ["граница поля на подложке (UI 3:1)", t.border, t.subtle, 3],
  ["кольцо фокуса на карточке (UI 3:1)", t.focus, t.surface, 3],
  ["кольцо фокуса на подложке (UI 3:1)", t.focus, t.subtle, 3],
];
for (const [name, a, b, need] of pairs) {
  const r = cr(a, b);
  console.log(
    `${r >= need ? "PASS" : "FAIL"}  ${r.toFixed(2)} / ${need}  ${name}`,
  );
}
