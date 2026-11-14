import {
  dispositionForContentType,
  MODULE_FILE_POLICY,
  moduleFileViolation,
  PPTX_CONTENT_TYPE,
  requestModuleFileUploadSchema,
  StoredFilePurpose,
} from '@gns/shared';

const MB = 1024 * 1024;

describe('module file policy (D3)', () => {
  it('maps each module purpose to its stored purpose', () => {
    expect(MODULE_FILE_POLICY.video.storedPurpose).toBe(StoredFilePurpose.ModuleVideo);
    expect(MODULE_FILE_POLICY.presentacion.storedPurpose).toBe(
      StoredFilePurpose.ModulePresentation,
    );
  });

  it('allows mp4 and webm videos up to 500 MB', () => {
    expect(moduleFileViolation('video', 'video/mp4', 500 * MB)).toBeNull();
    expect(moduleFileViolation('video', 'video/webm', 1)).toBeNull();
    expect(moduleFileViolation('video', 'video/mp4', 500 * MB + 1)?.field).toBe('size');
    expect(moduleFileViolation('video', 'video/quicktime', 1)?.field).toBe('contentType');
  });

  it('allows PDF, images and PPTX presentations up to 50 MB', () => {
    for (const type of [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      PPTX_CONTENT_TYPE,
    ]) {
      expect(moduleFileViolation('presentacion', type, 50 * MB)).toBeNull();
    }
    expect(moduleFileViolation('presentacion', 'application/pdf', 50 * MB + 1)?.field).toBe('size');
    expect(moduleFileViolation('presentacion', 'video/mp4', 1)?.field).toBe('contentType');
    expect(moduleFileViolation('presentacion', 'image/svg+xml', 1)?.field).toBe('contentType');
    expect(moduleFileViolation('presentacion', 'text/html', 1)?.field).toBe('contentType');
  });

  it('serves PPTX as a download and everything else inline', () => {
    expect(dispositionForContentType(PPTX_CONTENT_TYPE)).toBe('attachment');
    for (const type of ['video/mp4', 'application/pdf', 'image/png']) {
      expect(dispositionForContentType(type)).toBe('inline');
    }
  });
});

describe('requestModuleFileUploadSchema', () => {
  const valid = { purpose: 'video', name: 'clase.mp4', contentType: 'video/mp4', size: 1000 };

  it('accepts a valid request', () => {
    expect(requestModuleFileUploadSchema.parse(valid)).toEqual(valid);
  });

  it('reports the field of a disallowed type or size', () => {
    const type = requestModuleFileUploadSchema.safeParse({ ...valid, contentType: 'text/plain' });
    const size = requestModuleFileUploadSchema.safeParse({ ...valid, size: 600 * MB });

    expect(type.error?.issues[0]?.path).toEqual(['contentType']);
    expect(size.error?.issues[0]?.path).toEqual(['size']);
  });

  it.each([
    { size: 0 },
    { size: -1 },
    { size: 1.5 },
    { purpose: 'certificado' },
    { name: '   ' },
    { extra: true },
  ])('rejects %p', (patch) => {
    expect(requestModuleFileUploadSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});
