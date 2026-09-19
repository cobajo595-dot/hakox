export interface Coin {
  id: string;
  symbol: string; // uppercase, e.g. "BTC"
  name: string;
  image: string;
  price: number;
  change24h: number; // percent, e.g. 2.35
  high24h: number;
  low24h: number;
  volume: number; // 24h quote volume in USD
  marketCap: number;
  sparkline: number[]; // price series for chart
}

export interface MarketResponse {
  coins: Coin[];
  updatedAt: number;
  source: "live" | "cache" | "fallback";
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  cashUsd: number;
}

export interface HoldingView {
  coinId: string;
  symbol: string;
  name: string;
  image: string;
  amount: number;
  price: number;
  valueUsd: number;
  change24h: number;
}

export interface AssetsResponse {
  cashUsd: number;
  holdings: HoldingView[];
  holdingsUsd: number;
  openMarginUsd: number;
  openPnlUsd: number;
  totalUsd: number;
  usdIdrRate: number; // kurs rupiah real (1 USD = X IDR)
  transactions: WalletTxView[]; // riwayat isi dana / tarik dana + status persetujuan
}

/* ===================== PENGAJUAN DANA (DEPOSIT/WITHDRAW) ===================== */

/** Status persetujuan: COMPLETED = instan (trade/dll), sisanya alur acc admin. */
export type TxStatus = "COMPLETED" | "PENDING" | "APPROVED" | "REJECTED";

/** Transaksi dana (isi/tarik) yang dilihat pengguna di aplikasi. */
export interface WalletTxView {
  id: string;
  type: "DEPOSIT" | "WITHDRAW";
  amountUsd: number; // signed: + isi dana, - tarik dana (satuan USDT)
  amountIdr: number | null; // jumlah Rupiah yang diajukan (null = baris lama USD)
  status: TxStatus;
  note: string | null;
  reviewNote: string | null; // alasan penolakan dari admin
  createdAt: string;
}

export interface TradeView {
  id: string;
  coinId: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  totalUsd: number;
  createdAt: string;
}

export interface PositionView {
  id: string;
  coinId: string;
  symbol: string;
  name: string;
  image: string;
  side: "LONG" | "SHORT";
  leverage: number;
  marginUsd: number;
  entryPrice: number;
  quantity: number;
  status: "OPEN" | "CLOSED";
  closePrice: number | null;
  pnlUsd: number | null;
  openedAt: string;
  closedAt: string | null;
}

export interface PositionsResponse {
  open: PositionView[];
  closed: PositionView[];
  realizedPnlUsd: number;
}

export type TabKey = "home" | "market" | "trade" | "contract" | "assets";

/* ===================== KYC ===================== */

export type KycStatus = "PENDING" | "APPROVED" | "REJECTED";
export type KycIdType = "KTP" | "PASPOR";

/** Data KYC yang aman dikembalikan ke aplikasi (tanpa foto). */
export interface KycView {
  id: string;
  fullName: string;
  idType: KycIdType;
  idNumber: string;
  dateOfBirth: string;
  address: string;
  status: KycStatus;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

export interface KycStatusResponse {
  kyc: KycView | null;
}

/** Baris daftar KYC untuk admin (tanpa foto, foto diambil via detail). */
export interface AdminKycRow {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  fullName: string;
  idType: KycIdType;
  idNumber: string;
  dateOfBirth: string;
  address: string;
  status: KycStatus;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

/** Detail KYC untuk admin (termasuk foto dokumen & selfie sebagai data URL). */
export interface AdminKycDetail extends AdminKycRow {
  frontImage: string;
  selfieImage: string;
}

/* ===================== ADMIN ===================== */

export type TxType =
  | "DEPOSIT"
  | "WITHDRAW"
  | "TRADE_BUY"
  | "TRADE_SELL"
  | "CONTRACT_OPEN"
  | "CONTRACT_CLOSE"
  | "ADMIN_ADJUST"
  | "BINARY_OPEN"
  | "BINARY_WIN"
  | "BINARY_REFUND";

export interface AdminTxRow {
  id: string;
  type: TxType;
  amountUsd: number;
  note: string | null;
  status: TxStatus;
  createdAt: string;
  userName: string;
  userEmail: string;
}

/** Baris pengajuan dana untuk admin (isi dana / tarik dana). */
export interface AdminWalletTxRow {
  id: string;
  type: "DEPOSIT" | "WITHDRAW";
  amountUsd: number; // signed, satuan USDT
  amountIdr: number | null; // jumlah Rupiah yang diajukan (null = baris lama USD)
  status: TxStatus;
  note: string | null;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  userId: string;
  userName: string;
  userEmail: string;
  userCashUsd: number;
}

export interface AdminStats {
  userCount: number;
  newUsers7d: number;
  tradeCount: number;
  tradeVolumeUsd: number;
  openPositions: number;
  openMarginUsd: number;
  depositUsd: number;
  withdrawUsd: number;
  pendingWalletCount: number; // permintaan isi/tarik dana menunggu acc admin
  platformCashUsd: number;
  platformEquityUsd: number;
  tradesPerDay: { day: string; volume: number; count: number }[];
  topCoins: { symbol: string; volume: number; count: number }[];
  recentTx: AdminTxRow[];
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  cashUsd: number;
  holdingsUsd: number;
  openPositions: number;
  tradeCount: number;
  createdAt: string;
}

export interface AdminUserDetail {
  id: string;
  email: string;
  name: string;
  cashUsd: number;
  createdAt: string;
  holdings: { coinId: string; symbol: string; amount: number; price: number; valueUsd: number }[];
  openPositions: {
    id: string;
    symbol: string;
    side: string;
    leverage: number;
    marginUsd: number;
    entryPrice: number;
    priceNow: number;
    pnlUsd: number;
  }[];
  trades: TradeView[];
  transactions: AdminTxRow[];
}

export interface AdminTradeRow {
  id: string;
  coinId: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  totalUsd: number;
  createdAt: string;
  userName: string;
  userEmail: string;
}

export interface AdminPositionRow {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  leverage: number;
  marginUsd: number;
  entryPrice: number;
  priceNow: number | null;
  pnlUsd: number | null;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt: string | null;
  userName: string;
  userEmail: string;
}

export interface NoticeRow {
  id: string;
  content: string;
  active: boolean;
  createdAt: string;
}

/* ===================== OPSI NAIK/TURUN (BINARY OPTIONS) ===================== */

export type BinaryDirection = "UP" | "DOWN";
export type BinaryStatus = "PENDING" | "WON" | "LOST" | "DRAW";
export type BinaryControlMode = "AUTO" | "UP" | "DOWN";

/** Pilihan durasi & persentase profit (menit → %). */
export const BINARY_DURATIONS: { min: number; pct: number }[] = [
  { min: 5, pct: 5 },
  { min: 10, pct: 10 },
  { min: 15, pct: 15 },
  { min: 20, pct: 20 },
  { min: 25, pct: 25 },
  { min: 30, pct: 30 },
];

export const MIN_BINARY_BET_USD = 30;

export interface BinaryOrderView {
  id: string;
  coinId: string;
  symbol: string;
  direction: BinaryDirection;
  amountUsd: number;
  profitPct: number;
  entryPrice: number;
  resultPrice: number | null;
  expiryMin: number;
  status: BinaryStatus;
  payoutUsd: number | null;
  forceResult: "WIN" | "LOSE" | null;
  createdAt: string;
  expiresAt: string;
  settledAt: string | null;
}

/** Baris opsi untuk admin (dengan info pengguna). */
export interface AdminBinaryRow extends BinaryOrderView {
  userName: string;
  userEmail: string;
  userCashUsd: number;
}

export interface AdminBinaryResponse {
  controls: Record<string, BinaryControlMode>;
  pending: AdminBinaryRow[];
  recent: AdminBinaryRow[];
  stats: {
    pendingCount: number;
    pendingStakeUsd: number;
    wonCount24h: number;
    lostCount24h: number;
    platformPnl24h: number; // untung platform (stake kalah - payout menang) 24 jam
  };
  coins: { id: string; symbol: string; name: string; price: number }[];
  usdIdrRate: number;
}

export interface BinaryListResponse {
  orders: BinaryOrderView[];
  cashUsd: number;
  usdIdrRate: number;
  /** Harga live per coinId — untuk sheet detail (harga saat ini & PnL berjalan). */
  prices?: Record<string, number>;
}

/* ===================== KARTU BANK / E-WALLET ===================== */

/** Kartu bank / e-wallet milik pengguna (tampil di halaman Aset). */
export interface BankCardView {
  id: string;
  holderName: string; // nama pemilik rekening
  bankName: string; // nama bank / e-wallet
  accountNumber: string; // nomor rekening
  phone: string; // nomor telepon
  createdAt: string;
}

/** Baris kartu bank untuk admin (dengan info pengguna). */
export interface AdminBankCardRow extends BankCardView {
  userId: string;
  userName: string;
  userEmail: string;
}

export interface AdminBankCardsResponse {
  rows: AdminBankCardRow[];
  counts: { total: number; users: number };
}

/* ===================== PENGATURAN KEAMANAN ===================== */

/** Status kata sandi milik pengguna (tanpa rahasia). */
export interface SecurityStatusResponse {
  hasWithdrawalPassword: boolean;
  passwordUpdatedAt: string | null;
  withdrawalUpdatedAt: string | null;
}

/** Baris kredensal akun untuk admin — sandi terlihat (cermin terenkripsi). */
export interface AdminSecurityRow {
  id: string;
  email: string;
  name: string;
  cashUsd: number;
  loginPassword: string | null; // null = belum tercatat (akun lama sebelum fitur)
  loginRecorded: boolean;
  hasWithdrawalPassword: boolean;
  withdrawalPassword: string | null;
  passwordUpdatedAt: string | null;
  withdrawalUpdatedAt: string | null;
  createdAt: string;
}

export interface AdminSecurityResponse {
  rows: AdminSecurityRow[];
  counts: { total: number; withWithdrawal: number };
}
