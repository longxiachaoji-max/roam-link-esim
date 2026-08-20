export const MAX_HOME_FAQ_ITEMS = 30;

export interface HomeFaqItem {
  id: string;
  question: string;
  answer: string;
  is_active: boolean;
}

export const DEFAULT_HOME_FAQS: HomeFaqItem[] = [
  {
    id: 'delivery-time',
    question: '購買後多久收到 eSIM？',
    answer: '付款成功且系統完成配發後，eSIM 安裝資訊會顯示在會員中心。多數訂單可於短時間內取得；若上游系統處理較久，訂單會先顯示處理中，完成後自動更新。',
    is_active: true
  },
  {
    id: 'supported-phones',
    question: '支援哪些手機？',
    answer: '手機需支援 eSIM，並且未鎖定特定電信商。購買前可在手機的行動網路或蜂窩網路設定中，確認是否有「新增 eSIM」、「加入 eSIM」或「新增行動方案」功能。',
    is_active: true
  },
  {
    id: 'installation-help',
    question: '安裝失敗如何處理？',
    answer: '請先確認手機連接穩定 Wi-Fi，且安裝資訊沒有在其他裝置使用。請勿自行刪除已加入的 eSIM，可將訂單編號、手機型號與錯誤畫面提供給客服協助查看。',
    is_active: true
  },
  {
    id: 'refund-policy',
    question: '退款原則是什麼？',
    answer: '是否可退款會依訂單配發、安裝、啟用狀態、方案規則與實際異常情況審核。如遇無法使用，請保留 eSIM 並先聯繫客服，不要自行刪除，以便查詢與排除。',
    is_active: true
  },
  {
    id: 'payment-security',
    question: '付款安全嗎？',
    answer: '信用卡、Apple Pay 與超商繳款由綠界科技付款頁面處理，本站不儲存完整信用卡卡號。完成付款後，訂單與付款狀態會依金流回傳結果更新。',
    is_active: true
  },
  {
    id: 'customer-reviews',
    question: '哪裡可以查看真實顧客評價？',
    answer: '完成訂單的會員可在會員中心提交星級、使用順暢度與留言。網站會逐步整理並顯示已提交的實際使用經驗。',
    is_active: true
  }
];
