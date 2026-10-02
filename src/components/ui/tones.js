// ===================================================================
// Palette des briques UI — classes Tailwind écrites en entier
// (Tailwind ne détecte pas les classes construites dynamiquement).
// Reprend à l'identique les couleurs utilisées avant la refacto.
// ===================================================================

const tone = (c) => c; // lisibilité : chaque entrée liste ses classes complètes

export const TONES = {
  green: tone({
    text: "text-green-600 dark:text-green-400",
    iconBg: "bg-green-500/15",
    soft: "bg-green-50 dark:bg-green-900/20",
    softHover: "hover:bg-green-100 dark:hover:bg-green-900/30",
    plainHover: "hover:bg-green-50 dark:hover:bg-green-900/20",
    active: "bg-green-100 dark:bg-green-900/40 ring-2 ring-green-400 dark:ring-green-500 shadow-md shadow-green-500/10",
  }),
  red: tone({
    text: "text-red-600 dark:text-red-400",
    iconBg: "bg-red-500/15",
    soft: "bg-red-50 dark:bg-red-900/20",
    softHover: "hover:bg-red-100 dark:hover:bg-red-900/30",
    plainHover: "hover:bg-red-50 dark:hover:bg-red-900/20",
    active: "bg-red-100 dark:bg-red-900/40 ring-2 ring-red-400 dark:ring-red-500 shadow-md shadow-red-500/10",
  }),
  indigo: tone({
    text: "text-indigo-600 dark:text-indigo-400",
    iconBg: "bg-indigo-500/15",
    soft: "bg-indigo-50 dark:bg-indigo-900/20",
    softHover: "hover:bg-indigo-100 dark:hover:bg-indigo-900/30",
    plainHover: "hover:bg-indigo-50 dark:hover:bg-indigo-900/20",
    active: "bg-indigo-100 dark:bg-indigo-900/40 ring-2 ring-indigo-400 dark:ring-indigo-500 shadow-md shadow-indigo-500/10",
  }),
  pink: tone({
    text: "text-pink-600 dark:text-pink-400",
    iconBg: "bg-pink-500/15",
    soft: "bg-pink-50 dark:bg-pink-900/20",
    softHover: "hover:bg-pink-100 dark:hover:bg-pink-900/30",
    plainHover: "hover:bg-pink-50 dark:hover:bg-pink-900/20",
    active: "bg-pink-100 dark:bg-pink-900/40 ring-2 ring-pink-400 dark:ring-pink-500 shadow-md shadow-pink-500/10",
  }),
  yellow: tone({
    text: "text-yellow-600 dark:text-yellow-400",
    iconBg: "bg-yellow-500/15",
    soft: "bg-yellow-50 dark:bg-yellow-900/20",
    softHover: "hover:bg-yellow-100 dark:hover:bg-yellow-900/30",
    plainHover: "hover:bg-yellow-50 dark:hover:bg-yellow-900/20",
    active: "bg-yellow-100 dark:bg-yellow-900/40 ring-2 ring-yellow-400 dark:ring-yellow-500 shadow-md shadow-yellow-500/10",
  }),
  blue: tone({
    text: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-500/15",
    soft: "bg-blue-50 dark:bg-blue-900/20",
    softHover: "hover:bg-blue-100 dark:hover:bg-blue-900/30",
    plainHover: "hover:bg-blue-50 dark:hover:bg-blue-900/20",
    active: "bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-400 dark:ring-blue-500 shadow-md shadow-blue-500/10",
  }),
  orange: tone({
    text: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-500/15",
    soft: "bg-orange-50 dark:bg-orange-900/20",
    softHover: "hover:bg-orange-100 dark:hover:bg-orange-900/30",
    plainHover: "hover:bg-orange-50 dark:hover:bg-orange-900/20",
    active: "bg-orange-100 dark:bg-orange-900/40 ring-2 ring-orange-400 dark:ring-orange-500 shadow-md shadow-orange-500/10",
  }),
  purple: tone({
    text: "text-purple-600 dark:text-purple-400",
    iconBg: "bg-purple-500/15",
    soft: "bg-purple-50 dark:bg-purple-900/20",
    softHover: "hover:bg-purple-100 dark:hover:bg-purple-900/30",
    plainHover: "hover:bg-purple-50 dark:hover:bg-purple-900/20",
    active: "bg-purple-100 dark:bg-purple-900/40 ring-2 ring-purple-400 dark:ring-purple-500 shadow-md shadow-purple-500/10",
  }),
  gray: tone({
    text: "text-gray-600 dark:text-gray-400",
    iconBg: "bg-gray-500/15",
    soft: "bg-gray-50 dark:bg-gray-700/40",
    softHover: "hover:bg-gray-100 dark:hover:bg-gray-700/60",
    plainHover: "hover:bg-gray-50 dark:hover:bg-gray-700/40",
    active: "bg-gray-200 dark:bg-gray-700 ring-2 ring-gray-400 dark:ring-gray-500 shadow-md shadow-gray-500/10",
  }),
};

export const getTone = (name) => TONES[name] || TONES.gray;
