/**
 * Abre el diálogo de impresión («Guardar como PDF») con `title` como título del documento y lo
 * restaura cuando termina (`afterprint`).
 */
export function printWithTitle(title: string): void {
  const previous = document.title;
  const restore = () => {
    document.title = previous;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  document.title = title;
  window.print();
}
