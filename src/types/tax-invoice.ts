export type TaxInvoiceType = "sales" | "purchase";
export type TaxInvoiceStatus = "issued" | "cancelled";

export const TAX_INVOICE_TYPES: TaxInvoiceType[] = ["sales", "purchase"];

export type TaxInvoice = {
  id: string;
  type: TaxInvoiceType;
  issue_date: string;
  supplier_name: string;
  supplier_biz_no: string;
  receiver_name: string;
  receiver_biz_no: string;
  supply_amount: number;
  tax_amount: number;
  total_amount: number;
  description: string | null;
  status: TaxInvoiceStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type TaxInvoiceInput = {
  type: TaxInvoiceType;
  issue_date: string;
  supplier_name: string;
  supplier_biz_no?: string;
  receiver_name: string;
  receiver_biz_no?: string;
  supply_amount: number;
  tax_amount: number;
  total_amount: number;
  description?: string;
  status?: TaxInvoiceStatus;
};
