// 📄 utils/a11y.js — Helpers d'accessibilité
// Créé lors de l'audit Design Review (juillet 2026)

/**
 * Props d'accessibilité pour rendre un élément non-bouton (div, span)
 * activable au clavier (Enter / Espace) et navigable au Tab, conformément
 * à WCAG. À étaler sur l'élément à la place d'un simple onClick.
 *
 * Usage :
 *   <div {...keyboardClickable(() => doSomething())} className="...">
 *
 * @param {Function} onActivate - Handler appelé au clic ou au clavier.
 * @returns {Object} Props : role, tabIndex, onClick, onKeyDown.
 */
export function keyboardClickable(onActivate) {
  return {
    role: "button",
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate(e);
      }
    },
  };
}
