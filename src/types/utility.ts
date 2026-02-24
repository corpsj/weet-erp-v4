export type UtilityCategory = "전기" | "수도" | "가스" | "인터넷" | "기타";
export type UtilityProcessingStatus = "processed" | "manual" | "processing";

export const UTILITY_CATEGORIES: UtilityCategory[] = ["전기", "수도", "가스", "인터넷", "기타"];
export const UTILITY_PROCESSING_STATUSES: UtilityProcessingStatus[] = ["processed", "manual", "processing"];

export type UtilityBill = {
  id: string;
  company_id: string | null;
  category: UtilityCategory;
  billing_month: string;
  amount: number;
  image_path: string | null;
  memo: string | null;
  processing_status: UtilityProcessingStatus;
  is_paid: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type UtilityBillInput = {
  category: UtilityCategory;
  billing_month: string;
  amount: number;
  memo?: string;
  image_path?: string | null;
  processing_status?: UtilityProcessingStatus;
  is_paid?: boolean;
};

export type UtilityAnalysisResult = {
  category: UtilityCategory;
  billing_month: string;
  amount: number;
};
