import { parseAnswerText, parseInline } from './answer-text';

describe('answer text', () => {
  it('splits bold fragments and keeps an unpaired marker as text', () => {
    expect(parseInline('Son **44 horas** semanales')).toEqual([
      { text: 'Son ', bold: false },
      { text: '44 horas', bold: true },
      { text: ' semanales', bold: false },
    ]);
    expect(parseInline('Sin pareja ** aquí')).toEqual([
      { text: 'Sin pareja ** aquí', bold: false },
    ]);
  });

  it('groups consecutive bullets into one list and keeps paragraphs apart', () => {
    const blocks = parseAnswerText('Intro.\n\n- Uno **a**\n- Dos\nCierre.');
    expect(blocks.map((block) => block.kind)).toEqual(['paragraph', 'list', 'paragraph']);
    const list = blocks[1];
    expect(list?.kind === 'list' && list.items).toHaveLength(2);
  });

  it('never turns the text into markup: tags and links stay as plain text', () => {
    const blocks = parseAnswerText('<img src=x onerror=alert(1)> [link](http://x)');
    expect(blocks).toEqual([
      {
        kind: 'paragraph',
        parts: [{ text: '<img src=x onerror=alert(1)> [link](http://x)', bold: false }],
      },
    ]);
  });

  it('returns no blocks for an empty answer', () => {
    expect(parseAnswerText('  \n ')).toEqual([]);
  });
});
