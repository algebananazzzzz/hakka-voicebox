import type { Entry, Library } from './library';

/** [english, 中文, 拼音, 客家话罗马拼音, isSentence?] */
type SeedRow = [string, string, string, string, 1?];

const SEED: [string, SeedRow[]][] = [
  [
    '招呼语',
    [
      ['me', '我', 'wǒ', 'ngài'],
      ['you', '你', 'nǐ', 'ngì'],
      ['he', '他', 'tā', 'kì'],
      ['we', '我们', 'wǒmen', 'ngài-têu'],
      ['Hello', '你好', 'nǐ hǎo', 'ngì-hó'],
      ['Thank you', '谢谢', 'xièxie', 'àn-cí-se'],
      ['Sorry', '对不起', 'duìbuqǐ', 'tui-chhû'],
      ['Yes', '是', 'shì', 'he'],
      ['No', '不是', 'bú shì', 'm̀-he'],
      ['Goodbye', '再见', 'zàijiàn', 'hà-pái'],
    ],
  ],
  [
    '屋家人',
    [
      ['father', '爸爸', 'bàba', 'a-pâ'],
      ['mother', '妈妈', 'māma', 'a-mê'],
      ['grandfather', '爷爷', 'yéye', 'a-kûng'],
      ['grandmother', '奶奶', 'nǎinai', 'a-phò'],
      ['brother', '哥哥', 'gēge', 'a-kô'],
      ['sister', '姐姐', 'jiějie', 'a-chiá'],
      ['child', '小孩', 'xiǎohái', 'se-ngìn-è'],
      ['friend', '朋友', 'péngyou', 'phèn-yû'],
    ],
  ],
  [
    '数目',
    [
      ['one', '一', 'yī', 'yit'],
      ['two', '二', 'èr', 'ngi'],
      ['three', '三', 'sān', 'sâm'],
      ['four', '四', 'sì', 'si'],
      ['five', '五', 'wǔ', 'ǹg'],
      ['six', '六', 'liù', 'liuk'],
      ['seven', '七', 'qī', 'chhit'],
      ['eight', '八', 'bā', 'pat'],
      ['nine', '九', 'jiǔ', 'kiú'],
      ['ten', '十', 'shí', 'sṳ̍p'],
    ],
  ],
  [
    '食物饮料',
    [
      ['eat', '吃', 'chī', 'sṳ̍t'],
      ['drink', '喝', 'hē', 'lṳ̀m'],
      ['rice', '饭', 'fàn', 'fàn'],
      ['water', '水', 'shuǐ', 'súi'],
      ['tea', '茶', 'chá', 'chhà'],
      ['meat', '肉', 'ròu', 'ngiuk'],
      ['vegetables', '菜', 'cài', 'chhoi'],
      ['delicious', '好吃', 'hǎochī', 'hó-sṳ̍t'],
      ['hungry', '饿', 'è', 'tú-kî'],
      ['full', '饱', 'bǎo', 'páu'],
    ],
  ],
  [
    '动作与形容',
    [
      ['go', '去', 'qù', 'hi'],
      ['come', '来', 'lái', 'lòi'],
      ['look', '看', 'kàn', 'khon'],
      ['sleep', '睡觉', 'shuìjiào', 'soi-muk'],
      ['speak', '说', 'shuō', 'kóng'],
      ['want', '要', 'yào', 'oi'],
      ['have', '有', 'yǒu', 'yû'],
      ['buy', '买', 'mǎi', 'mâi'],
      ['big', '大', 'dà', 'thai'],
      ['small', '小', 'xiǎo', 'se'],
      ['good', '好', 'hǎo', 'hó'],
      ['hot', '热', 'rè', 'ngiet'],
      ['cold', '冷', 'lěng', 'lâng'],
      ['new', '新', 'xīn', 'sîn'],
      ['old', '旧', 'jiù', 'khiu'],
    ],
  ],
  [
    '日常',
    [
      ['home', '家', 'jiā', 'vuk-kâ'],
      ['money', '钱', 'qián', 'chhièn'],
      ['today', '今天', 'jīntiān', 'kîm-pû-ngit'],
      ['tomorrow', '明天', 'míngtiān', 'thiên-kông-ngit'],
      ['now', '现在', 'xiànzài', 'lia-ha'],
      ['What is this?', '这是什么', 'zhè shì shénme', 'lia he mak-kai', 1],
      ['How much?', '多少钱', 'duōshao qián', 'kí-tô chhièn', 1],
      ['Have you eaten?', '你吃了吗', 'nǐ chī le ma', 'ngì sṳ̍t-fàn màng', 1],
    ],
  ],
];

/** The library served before anything has been saved. Built fresh on each call because callers mutate it. */
export function starterLibrary(): Library {
  const entries: Entry[] = [];
  for (const [category, rows] of SEED) {
    for (const [en, zh, py, rom, sentence] of rows) {
      const order = entries.length;
      entries.push({
        id: `seed-${order}`,
        order,
        category,
        kind: sentence ? 'sentence' : 'word',
        zh,
        en,
        py,
        rom,
        audioKey: null,
      });
    }
  }
  return {
    version: 1,
    settings: {
      name: '杨老师',
      intro: '我讲了一辈子客家话。这门话讲的人越来越少，我想把它一句一句录下来，把客家话传下去。',
      note: '话是根，声是脉。客家话陪了我一辈子，我把它一句一句录在这里，希望这门话一直有人讲、有人听。',
      portraitKey: null,
      greetingKey: null,
    },
    categories: SEED.map(([category]) => category),
    entries,
  };
}
