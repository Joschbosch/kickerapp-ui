/** Das Eingabefeld zu einem Label („Name“, „Anzahl Tische“, ...), so wie der Nutzer es findet. */
export function fieldByLabel(root: HTMLElement, label: string): HTMLInputElement {
  const formField = Array.from(root.querySelectorAll('mat-form-field')).find(
    (entry) => entry.querySelector('mat-label')?.textContent?.trim() === label,
  );
  const input = formField?.querySelector('input');
  if (!input) {
    throw new Error(`Feld „${label}“ nicht gefunden`);
  }
  return input;
}
