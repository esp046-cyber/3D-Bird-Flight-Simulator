export const translations = {
    // ENGLISH (Default)
    en: {
        title: "SKYSOAR",
        alt: "ALT:",
        spd: "SPD:",
        score_lbl: "SCORE",
        dive: "DIVE",
        pause: "PAUSE",
        paused_title: "PAUSED",
        resume: "RESUME",
        biome: "CHANGE BIOME",
        hq_on: "HQ: ON",
        hq_off: "HQ: OFF",
        lang_btn: "LANG: EN",
        loading: "Loading World...",
        a11y_start: "Game Started. Use arrow keys to fly.",
    },
    
    // FILIPINO (Tagalog)
    fil: {
        title: "LIPAD PINOY",
        alt: "TAAS:",
        spd: "BILIS:",
        score_lbl: "PUNTOS",
        dive: "LUSONG",
        pause: "TIGIL",
        paused_title: "NAKATIGIL",
        resume: "ITULOY",
        biome: "IBAHIN ANG MUNDO",
        hq_on: "KALIDAD: MATAAS",
        hq_off: "KALIDAD: MABABA",
        lang_btn: "WIKA: FIL",
        loading: "Naglo-load...",
        a11y_start: "Nagsimula na. Gamitin ang arrow keys.",
    },

    // SPANISH
    es: {
        title: "CIELO VUELO",
        alt: "ALT:",
        spd: "VEL:",
        score_lbl: "PUNTOS",
        dive: "PICADA",
        pause: "PAUSA",
        paused_title: "PAUSADO",
        resume: "REANUDAR",
        biome: "CAMBIAR BIOMA",
        hq_on: "CALIDAD: ALTA",
        hq_off: "CALIDAD: BAJA",
        lang_btn: "IDIOMA: ES",
        loading: "Cargando...",
        a11y_start: "Juego iniciado. Usa las flechas para volar.",
    },

    // JAPANESE
    ja: {
        title: "スカイ・ソアー",
        alt: "高度:",
        spd: "速度:",
        score_lbl: "スコア",
        dive: "急降下",
        pause: "一時停止",
        paused_title: "一時停止中",
        resume: "再開",
        biome: "バイオーム変更",
        hq_on: "画質: 高",
        hq_off: "画質: 低",
        lang_btn: "言語: JA",
        loading: "読み込み中...",
        a11y_start: "ゲーム開始。矢印キーで飛行します。",
    },

    // FRENCH
    fr: {
        title: "ENVOL CÉLESTE",
        alt: "ALT:",
        spd: "VIT:",
        score_lbl: "SCORE",
        dive: "PLONGER",
        pause: "PAUSE",
        paused_title: "EN PAUSE",
        resume: "REPRENDRE",
        biome: "CHANGER BIOME",
        hq_on: "QUALITÉ: HAUTE",
        hq_off: "QUALITÉ: BASSE",
        lang_btn: "LANGUE: FR",
        loading: "Chargement...",
        a11y_start: "Jeu commencé. Utilisez les flèches.",
    }
};

// --- UTILITY FUNCTIONS ---

/**
 * Detects user language preference or gets saved selection
 */
export function getLang() {
    // 1. Check saved preference
    const saved = localStorage.getItem('skysoar_lang');
    if (saved && translations[saved]) return saved;

    // 2. Check Browser Language
    const browserLang = navigator.language.split('-')[0]; // e.g., 'en-US' -> 'en'
    if (translations[browserLang]) return browserLang;

    // 3. Default to English
    return 'en';
}

/**
 * Sets language and reloads to apply changes everywhere
 */
export function setLang(lang) {
    if (translations[lang]) {
        localStorage.setItem('skysoar_lang', lang);
        location.reload(); // Hard reload ensures all UI updates safely
    }
}

/**
 * Cycles to the next available language
 */
export function cycleLang() {
    const keys = Object.keys(translations);
    const current = getLang();
    const nextIndex = (keys.indexOf(current) + 1) % keys.length;
    setLang(keys[nextIndex]);
}