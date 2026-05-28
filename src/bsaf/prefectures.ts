/**
 * src/bsaf/prefectures.ts
 * 市町村コード（6桁）先頭2桁 → 都道府県 BSAF target 値マッピング
 *
 * 出典: JIS X 0401（都道府県コード）/ 気象庁 防災情報XML AreaCode (codeType="市町村等")
 */

export interface Prefecture {
  /** 都道府県コード（2桁ゼロ埋め） */
  code: string;
  /** 日本語名 */
  name: string;
  /** BSAF target 値（小文字 ISO 3166-2 風プレフィックス） */
  target: string;
}

export const PREFECTURES: Prefecture[] = [
  { code: "01", name: "北海道",   target: "jp-hokkaido"  },
  { code: "02", name: "青森県",   target: "jp-aomori"    },
  { code: "03", name: "岩手県",   target: "jp-iwate"     },
  { code: "04", name: "宮城県",   target: "jp-miyagi"    },
  { code: "05", name: "秋田県",   target: "jp-akita"     },
  { code: "06", name: "山形県",   target: "jp-yamagata"  },
  { code: "07", name: "福島県",   target: "jp-fukushima" },
  { code: "08", name: "茨城県",   target: "jp-ibaraki"   },
  { code: "09", name: "栃木県",   target: "jp-tochigi"   },
  { code: "10", name: "群馬県",   target: "jp-gunma"     },
  { code: "11", name: "埼玉県",   target: "jp-saitama"   },
  { code: "12", name: "千葉県",   target: "jp-chiba"     },
  { code: "13", name: "東京都",   target: "jp-tokyo"     },
  { code: "14", name: "神奈川県", target: "jp-kanagawa"  },
  { code: "15", name: "新潟県",   target: "jp-niigata"   },
  { code: "16", name: "富山県",   target: "jp-toyama"    },
  { code: "17", name: "石川県",   target: "jp-ishikawa"  },
  { code: "18", name: "福井県",   target: "jp-fukui"     },
  { code: "19", name: "山梨県",   target: "jp-yamanashi" },
  { code: "20", name: "長野県",   target: "jp-nagano"    },
  { code: "21", name: "岐阜県",   target: "jp-gifu"      },
  { code: "22", name: "静岡県",   target: "jp-shizuoka"  },
  { code: "23", name: "愛知県",   target: "jp-aichi"     },
  { code: "24", name: "三重県",   target: "jp-mie"       },
  { code: "25", name: "滋賀県",   target: "jp-shiga"     },
  { code: "26", name: "京都府",   target: "jp-kyoto"     },
  { code: "27", name: "大阪府",   target: "jp-osaka"     },
  { code: "28", name: "兵庫県",   target: "jp-hyogo"     },
  { code: "29", name: "奈良県",   target: "jp-nara"      },
  { code: "30", name: "和歌山県", target: "jp-wakayama"  },
  { code: "31", name: "鳥取県",   target: "jp-tottori"   },
  { code: "32", name: "島根県",   target: "jp-shimane"   },
  { code: "33", name: "岡山県",   target: "jp-okayama"   },
  { code: "34", name: "広島県",   target: "jp-hiroshima" },
  { code: "35", name: "山口県",   target: "jp-yamaguchi" },
  { code: "36", name: "徳島県",   target: "jp-tokushima" },
  { code: "37", name: "香川県",   target: "jp-kagawa"    },
  { code: "38", name: "愛媛県",   target: "jp-ehime"     },
  { code: "39", name: "高知県",   target: "jp-kochi"     },
  { code: "40", name: "福岡県",   target: "jp-fukuoka"   },
  { code: "41", name: "佐賀県",   target: "jp-saga"      },
  { code: "42", name: "長崎県",   target: "jp-nagasaki"  },
  { code: "43", name: "熊本県",   target: "jp-kumamoto"  },
  { code: "44", name: "大分県",   target: "jp-oita"      },
  { code: "45", name: "宮崎県",   target: "jp-miyazaki"  },
  { code: "46", name: "鹿児島県", target: "jp-kagoshima" },
  { code: "47", name: "沖縄県",   target: "jp-okinawa"   },
];

const PREF_BY_CODE = new Map(PREFECTURES.map((p) => [p.code, p]));

/** 市町村コード（6桁文字列）から都道府県情報を返す。未知のコードは null。 */
export function prefectureFromMunicipalityCode(
  municipalityCode: string
): Prefecture | null {
  if (!municipalityCode || municipalityCode.length < 2) return null;
  return PREF_BY_CODE.get(municipalityCode.slice(0, 2)) ?? null;
}
