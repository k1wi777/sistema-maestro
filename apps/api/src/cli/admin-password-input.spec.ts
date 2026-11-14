import { Readable } from 'node:stream';
import { adminPasswordInput } from './admin-password-input';

async function readAll(input: Readable): Promise<string> {
  let text = '';
  for await (const chunk of input) {
    text += String(chunk);
  }
  return text;
}

const NO_PROMPT = () => Promise.reject(new Error('no debe preguntar'));

describe('adminPasswordInput', () => {
  it('uses ADMIN_INITIAL_PASSWORD without asking or reading stdin', async () => {
    const stdin = Object.assign(Readable.from(['otra-cosa\n']), { isTTY: true });
    const input = await adminPasswordInput(
      { ADMIN_INITIAL_PASSWORD: 'valor-de-prueba-123' },
      stdin,
      NO_PROMPT,
    );
    expect(await readAll(input)).toBe('valor-de-prueba-123\n');
    expect(stdin.readableFlowing).toBeNull();
  });

  it('treats an empty variable as undefined', async () => {
    const stdin = Object.assign(Readable.from(['desde-stdin-123\n']), { isTTY: false });
    const input = await adminPasswordInput({ ADMIN_INITIAL_PASSWORD: '' }, stdin, NO_PROMPT);
    expect(input).toBe(stdin);
  });

  it('without the variable and without a terminal, returns stdin', async () => {
    const stdin = Object.assign(Readable.from(['x\n']), { isTTY: false });
    expect(await adminPasswordInput({}, stdin, NO_PROMPT)).toBe(stdin);
  });

  it('with a terminal asks twice and returns the typed password', async () => {
    const answers = ['clave-escrita-123', 'clave-escrita-123'];
    const asked: string[] = [];
    const stdin = Object.assign(Readable.from([]), { isTTY: true });
    const input = await adminPasswordInput({}, stdin, (question) => {
      asked.push(question);
      return Promise.resolve(answers.shift() ?? '');
    });
    expect(asked).toHaveLength(2);
    expect(await readAll(input)).toBe('clave-escrita-123\n');
  });

  it('with a terminal rejects mismatched answers', async () => {
    const answers = ['una-clave-123456', 'otra-clave-123456'];
    const stdin = Object.assign(Readable.from([]), { isTTY: true });
    await expect(
      adminPasswordInput({}, stdin, () => Promise.resolve(answers.shift() ?? '')),
    ).rejects.toThrow('Las contraseñas no coinciden');
  });
});
