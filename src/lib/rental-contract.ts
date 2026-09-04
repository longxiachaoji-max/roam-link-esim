export const RENTAL_CONTRACT_VERSION = '2026-09-04-v1';

const BASE_RENTAL_CONTRACT_SECTIONS = [
  {
    title: '租金支付',
    body: '承租方需於取機前支付全額租金或支付押金。'
  },
  {
    title: '延遲歸還',
    body: '承租方應於租借到期前將手機歸還一飛通全球漫遊。如因承租方因素未能如期歸還，每逾期一日，需支付額外租借費用，金額為每日原價的 1.5 倍，並自應歸還日的隔日起計算。'
  },
  {
    title: '手機保護',
    body: '手機出借時已貼有保護膠膜，包含正面、背面與側邊，承租方不得擅自拆除。若承租方拆除膠膜，視同拆機或拆換零件，需送回原廠檢查；如產生檢查或維修報價，承租方不得異議。'
  },
  {
    title: '手機檢查與賠償',
    body: '手機歸還後將由出租方送回原廠進行檢查。如發現任何零件被拆換或損壞，承租方需依原廠報價進行賠償。'
  },
  {
    title: '手機損壞與維修',
    body: '手機使用期間如發生人為損壞、受潮、破損或刮傷等情形，承租方必須將手機送回原廠維修，並負擔維修費用。出租方不接受非原廠維修。'
  },
  {
    title: '押金退還',
    body: '原廠確認手機功能與外觀使用正常後，押金或證件約於 3 個工作日內退還。'
  }
] as const;

export function getRentalContractSections(subject = '租借商品') {
  const normalizedSubject = subject.trim() || '租借商品';
  return BASE_RENTAL_CONTRACT_SECTIONS.map(section => ({
    ...section,
    body: section.body.replaceAll('手機', normalizedSubject)
  }));
}

export function buildRentalContractSnapshot(lessee: string, subject = '租借商品') {
  return [
    '出租方（甲方）：一飛通全球漫遊 FirstRoamLink',
    `承租方（乙方）：${lessee || '會員本人'}`,
    '',
    `租借標的：${subject}`,
    '',
    ...getRentalContractSections(subject).map((section, index) => `${index + 1}. ${section.title}\n${section.body}`)
  ].join('\n\n');
}
