import styles from './YouTubeEmbed.module.css';

export interface YouTubeEmbedProps {
  /** Dirección ya calculada con `youTubeEmbedSrc` (siempre `www.youtube-nocookie.com`). */
  src: string;
  /** Título accesible del reproductor. */
  title: string;
}

/** Video de YouTube incrustado en modo de privacidad mejorada, 16:9 y sin reproducción automática. */
export function YouTubeEmbed({ src, title }: YouTubeEmbedProps) {
  return (
    <div className={styles.frame}>
      <iframe
        className={styles.iframe}
        src={src}
        title={title}
        allow="encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
      />
    </div>
  );
}
