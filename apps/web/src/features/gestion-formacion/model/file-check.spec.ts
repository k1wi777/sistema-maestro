import { acceptAttribute, fileProblem, formatFileSize, maxMegabytes } from './file-check';

const MB = 1024 * 1024;

describe('fileProblem', () => {
  it('acepta un MP4 de tamaño razonable y un PDF', () => {
    expect(fileProblem('video', { type: 'video/mp4', size: MB })).toBeNull();
    expect(fileProblem('presentacion', { type: 'application/pdf', size: 3 * MB })).toBeNull();
  });

  it('rechaza un tipo que no corresponde al propósito', () => {
    expect(fileProblem('video', { type: 'application/pdf', size: MB })).toContain('MP4 o WebM');
    expect(fileProblem('presentacion', { type: 'video/mp4', size: MB })).toContain('PPTX');
    expect(fileProblem('video', { type: '', size: MB })).toContain('no está permitido');
  });

  it('rechaza lo que supera el máximo y un archivo vacío', () => {
    expect(fileProblem('video', { type: 'video/mp4', size: 501 * MB })).toBe(
      'El archivo supera el máximo de 500 MB.',
    );
    expect(fileProblem('presentacion', { type: 'application/pdf', size: 51 * MB })).toBe(
      'El archivo supera el máximo de 50 MB.',
    );
    expect(fileProblem('video', { type: 'video/mp4', size: 0 })).toBe('El archivo está vacío.');
  });
});

describe('acceptAttribute y máximos', () => {
  it('toma la política compartida', () => {
    expect(acceptAttribute('video')).toBe('video/mp4,video/webm');
    expect(maxMegabytes('video')).toBe(500);
    expect(maxMegabytes('presentacion')).toBe(50);
  });
});

describe('formatFileSize', () => {
  it('muestra KB o MB', () => {
    expect(formatFileSize(850 * 1024)).toBe('850 KB');
    expect(formatFileSize(1.5 * MB)).toBe('1,5 MB');
    expect(formatFileSize(10)).toBe('1 KB');
  });
});
