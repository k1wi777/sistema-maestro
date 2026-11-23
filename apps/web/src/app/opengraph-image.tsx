import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PRODUCT_NAME } from '@gns/shared';
import { ImageResponse } from 'next/og';

export const alt = `${PRODUCT_NAME} · George Noble School`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// `ImageResponse` no lee CSS: los colores van literales, con el token de origen.
const NAVY = '#14254f'; // --navy
const RED = '#c8102e'; // --red
const WHITE = '#ffffff';

export default async function OpenGraphImage() {
  const shield = await readFile(join(process.cwd(), 'src/app/icon.png'));
  const shieldSrc = `data:image/png;base64,${shield.toString('base64')}`;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: '0 96px',
        background: NAVY,
        color: WHITE,
      }}
    >
      {/* El escudo tiene huecos transparentes: sobre fondo claro conserva su forma. */}
      <div
        style={{
          width: 256,
          height: 256,
          borderRadius: 128,
          background: WHITE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 72,
          flexShrink: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse no usa next/image */}
        <img src={shieldSrc} width={192} height={192} alt="" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <div style={{ fontSize: 40, letterSpacing: 4, textTransform: 'uppercase', opacity: 0.85 }}>
          George Noble School
        </div>
        <div style={{ fontSize: 96, fontWeight: 700, marginTop: 8 }}>{PRODUCT_NAME}</div>
        <div style={{ width: 120, height: 8, background: RED, marginTop: 28 }} />
        <div style={{ fontSize: 34, marginTop: 28, opacity: 0.85 }}>
          Planeación, formatos y formación docente
        </div>
      </div>
    </div>,
    { ...size },
  );
}
