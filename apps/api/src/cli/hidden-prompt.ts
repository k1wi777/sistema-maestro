const CTRL_C = '\u0003';
const CTRL_D = '\u0004';
const BACKSPACE = '\u007f';

/** Pide una línea por el terminal sin mostrarla (sin eco). Solo funciona con TTY. */
export function promptHidden(question: string): Promise<string> {
  const { stdin, stdout } = process;
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (settle: () => void) => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      settle();
    };
    const onData = (chunk: Buffer) => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\r' || char === '\n' || char === CTRL_D) {
          finish(() => resolve(value));
          return;
        }
        if (char === CTRL_C) {
          finish(() => reject(new Error('Operación cancelada')));
          return;
        }
        value = char === BACKSPACE || char === '\b' ? value.slice(0, -1) : value + char;
      }
    };
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}
