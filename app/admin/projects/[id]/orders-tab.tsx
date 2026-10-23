"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ProjectCostsData,
  OrderKind,
  FulfilmentStatus,
  BillType,
  PaymentMode,
  VendorOrderItem,
  BillItem,
} from "@/lib/costs/types";
import {
  saveBudgetLinesAction,
  createVendorOrderAction,
  updateVendorOrderStatusAction,
  createBillAction,
  cancelBillAction,
  createBillPaymentAction,
} from "@/lib/costs/actions";
import { uploadDocumentAction, getSignedDocumentUrlAction } from "@/lib/documents/actions";
import { formatPaise, rupeesToPaise } from "@/lib/money";
import { isVendorOrderLate } from "@/lib/rules/costs";
import {
  ShoppingBag,
  Receipt,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Check,
  X,
  Calendar,
  AlertTriangle,
  FileText,
  Upload,
  Download,
  CheckCircle2,
  Clock,
  Ban,
  Layers,
  IndianRupee,
  AlertCircle,
  Truck,
  Paperclip,
} from "lucide-react";

interface OrdersTabProps {
  projectId: string;
  projectCode: string;
  projectName: string;
  costData: ProjectCostsData;
  isDirector: boolean;
  isPurchase?: boolean;
  isAccounts?: boolean;
}

const ORDER_KIND_LABELS: Record<OrderKind, string> = {
  material: "Material",
  fabrication: "Fabrication",
  subcontract: "Subcontract",
  service: "Service",
};

const FULFILMENT_STATUS_LABELS: Record<FulfilmentStatus, { label: string; color: string }> = {
  ordered: { label: "Ordered", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  in_progress: { label: "In Progress", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  partially_fulfilled: { label: "Partially Fulfilled", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  fulfilled: { label: "Fulfilled", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  issue: { label: "Delivery Issue", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  cancelled: { label: "Cancelled", color: "bg-slate-700 text-slate-400 border-slate-600" },
};

const BILL_TYPE_LABELS: Record<BillType, string> = {
  supplier_bill: "Supplier Bill",
  subcontractor_bill: "Subcontractor Bill",
  direct_expense: "Direct Expense",
};

function getDefaultDates() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const delivery = new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10);
  const billDue = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  return { today, delivery, billDue };
}

export function OrdersTab({
  projectId,
  projectCode,
  projectName,
  costData,
  isDirector,
  isPurchase = false,
  isAccounts = false,
}: OrdersTabProps) {
  const router = useRouter();
  const [defaultDates] = useState(getDefaultDates);

  const canManageBudget = isDirector;
  const canManageOrders = isDirector || isPurchase;
  const canManageBills = isDirector || isAccounts;

  const todayStr = defaultDates.today;
  const defaultDeliveryDate = defaultDates.delivery;
  const defaultBillDueDate = defaultDates.billDue;

  // Modals
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);
  const [isUpdateOrderModalOpen, setIsUpdateOrderModalOpen] = useState(false);
  const [selectedOrderForUpdate, setSelectedOrderForUpdate] = useState<VendorOrderItem | null>(null);
  const [isCreateBillModalOpen, setIsCreateBillModalOpen] = useState(false);
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false);
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<BillItem | null>(null);
  const [isAttachDocModalOpen, setIsAttachDocModalOpen] = useState(false);
  const [docTarget, setDocTarget] = useState<{
    type: "order" | "bill";
    id: string;
    label: string;
  } | null>(null);

  // Loading & error
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  // 1. Budget Form state (initialized with current budget lines)
  const [budgetFormLines, setBudgetFormLines] = useState<
    Array<{ categoryId: string; categoryName: string; amount: string; note: string }>
  >(() => {
    return costData.categories
      .filter((c) => c.is_active)
      .map((cat) => {
        const existing = costData.budgetLines.find((b) => b.category_id === cat.id);
        return {
          categoryId: cat.id,
          categoryName: cat.name,
          amount: existing ? String(existing.amount_excl_gst) : "0",
          note: existing?.note || "",
        };
      });
  });

  // 2. Create Vendor Order Form state
  const [orderCategory, setOrderCategory] = useState(
    costData.categories.find((c) => c.is_active)?.id || ""
  );
  const [orderKind, setOrderKind] = useState<OrderKind>("material");
  const [orderVendorName, setOrderVendorName] = useState("");
  const [orderDesc, setOrderDesc] = useState("");
  const [orderAmountExclGst, setOrderAmountExclGst] = useState("");
  const [orderGstAmount, setOrderGstAmount] = useState("0");
  const [orderDate, setOrderDate] = useState(todayStr);
  const [orderExpectedDelivery, setOrderExpectedDelivery] = useState(defaultDeliveryDate);
  const [orderStatus, setOrderStatus] = useState<FulfilmentStatus>("ordered");
  const [orderDeliveryNote, setOrderDeliveryNote] = useState("");
  const [orderDocFile, setOrderDocFile] = useState<File | null>(null);

  // 3. Update Order Delivery Form state
  const [updateOrderStatus, setUpdateOrderStatus] = useState<FulfilmentStatus>("ordered");
  const [updateOrderDeliveryDate, setUpdateOrderDeliveryDate] = useState("");
  const [updateOrderNote, setUpdateOrderNote] = useState("");

  // 4. Create Bill Form state
  const [billCategory, setBillCategory] = useState(
    costData.categories.find((c) => c.is_active)?.id || ""
  );
  const [billType, setBillType] = useState<BillType>("supplier_bill");
  const [billVendorName, setBillVendorName] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(todayStr);
  const [billDueDate, setBillDueDate] = useState(defaultBillDueDate);
  const [billAmountExclGst, setBillAmountExclGst] = useState("");
  const [billGstAmount, setBillGstAmount] = useState("0");
  const [billLinkedOrderId, setBillLinkedOrderId] = useState<string>("");
  const [billNote, setBillNote] = useState("");
  const [billDocFile, setBillDocFile] = useState<File | null>(null);

  // 5. Record Bill Payment Form state
  const [paymentDate, setPaymentDate] = useState(todayStr);
  const [paymentAmountPaid, setPaymentAmountPaid] = useState("");
  const [paymentTdsAmount, setPaymentTdsAmount] = useState("0");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("bank_transfer");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  // 6. Attach Document Form state
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachDocTitle, setAttachDocTitle] = useState("");

  // Calculate bill outstanding helper
  function getBillOutstandingPaise(bill: BillItem): {
    totalPaise: number;
    settledPaise: number;
    outstandingPaise: number;
    isOverdue: boolean;
  } {
    const totalPaise = rupeesToPaise(bill.amount_excl_gst) + rupeesToPaise(bill.gst_amount || 0);
    const billPayments = costData.payments.filter((p) => p.bill_id === bill.id);
    let settledPaise = 0;
    for (const p of billPayments) {
      settledPaise += rupeesToPaise(p.amount_paid) + rupeesToPaise(p.tds_amount || 0);
    }
    const outstandingPaise = Math.max(0, totalPaise - settledPaise);
    const isOverdue = outstandingPaise > 0 && bill.due_date < todayStr;
    return { totalPaise, settledPaise, outstandingPaise, isOverdue };
  }

  // --- Handlers ---

  async function handleDownloadDoc(docId: string) {
    setDownloadingDocId(docId);
    setActionError(null);
    try {
      const res = await getSignedDocumentUrlAction(docId);
      if (res.error) {
        setActionError(res.error);
      } else if (res.downloadUrl) {
        window.open(res.downloadUrl, "_blank");
      }
    } catch {
      setActionError("Failed to generate document download URL");
    } finally {
      setDownloadingDocId(null);
    }
  }

  // Budget save
  async function handleSaveBudget(e: React.FormEvent) {
    e.preventDefault();
    if (!canManageBudget) return;
    setIsSubmitting(true);
    setActionError(null);

    const lines = budgetFormLines.map((l) => ({
      categoryId: l.categoryId,
      amountExclGst: Math.max(0, parseFloat(l.amount) || 0),
      note: l.note.trim() || null,
    }));

    const res = await saveBudgetLinesAction(projectId, lines);
    setIsSubmitting(false);

    if (res.error) {
      setActionError(res.error);
    } else {
      setIsBudgetModalOpen(false);
      router.refresh();
    }
  }

  // Create Order
  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!canManageOrders) return;
    setIsSubmitting(true);
    setActionError(null);

    const amountExcl = parseFloat(orderAmountExclGst);
    const gstAmt = parseFloat(orderGstAmount || "0");

    if (isNaN(amountExcl) || amountExcl < 0) {
      setActionError("Please enter a valid order amount");
      setIsSubmitting(false);
      return;
    }

    const res = await createVendorOrderAction({
      projectId,
      categoryId: orderCategory,
      kind: orderKind,
      vendorName: orderVendorName.trim(),
      description: orderDesc.trim(),
      amountExclGst: amountExcl,
      gstAmount: isNaN(gstAmt) ? 0 : gstAmt,
      orderDate,
      expectedDeliveryDate: orderExpectedDelivery,
      fulfilmentStatus: orderStatus,
      deliveryNote: orderDeliveryNote.trim() || null,
    });

    if (res.error) {
      setActionError(res.error);
      setIsSubmitting(false);
      return;
    }

    // Optional doc upload
    if (orderDocFile) {
      const formData = new FormData();
      formData.append("file", orderDocFile);
      formData.append("project_id", projectId);
      formData.append("category", "purchase_order");
      formData.append("title", `PO - ${orderVendorName} - ${orderDesc.slice(0, 30)}`);
      await uploadDocumentAction(null, formData);
    }

    setIsSubmitting(false);
    setIsCreateOrderModalOpen(false);
    setOrderDesc("");
    setOrderVendorName("");
    setOrderAmountExclGst("");
    setOrderGstAmount("0");
    setOrderDocFile(null);
    router.refresh();
  }

  // Open Update Order Modal
  function openUpdateOrderModal(order: VendorOrderItem) {
    setSelectedOrderForUpdate(order);
    setUpdateOrderStatus(order.fulfilment_status);
    setUpdateOrderDeliveryDate(order.expected_delivery_date);
    setUpdateOrderNote(order.delivery_note || "");
    setIsUpdateOrderModalOpen(true);
  }

  // Update Order Delivery
  async function handleUpdateOrderDelivery(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrderForUpdate || !canManageOrders) return;
    setIsSubmitting(true);
    setActionError(null);

    const res = await updateVendorOrderStatusAction(
      selectedOrderForUpdate.id,
      projectId,
      updateOrderStatus,
      updateOrderDeliveryDate,
      updateOrderNote.trim() || null
    );

    setIsSubmitting(false);
    if (res.error) {
      setActionError(res.error);
    } else {
      setIsUpdateOrderModalOpen(false);
      setSelectedOrderForUpdate(null);
      router.refresh();
    }
  }

  // Create Bill
  async function handleCreateBill(e: React.FormEvent) {
    e.preventDefault();
    if (!canManageBills) return;
    setIsSubmitting(true);
    setActionError(null);

    const amountExcl = parseFloat(billAmountExclGst);
    const gstAmt = parseFloat(billGstAmount || "0");

    if (isNaN(amountExcl) || amountExcl < 0) {
      setActionError("Please enter a valid bill amount");
      setIsSubmitting(false);
      return;
    }

    const res = await createBillAction({
      projectId,
      categoryId: billCategory,
      vendorOrderId: billLinkedOrderId || null,
      billType,
      vendorName: billVendorName.trim(),
      billNumber: billNumber.trim(),
      billDate,
      dueDate: billDueDate,
      amountExclGst: amountExcl,
      gstAmount: isNaN(gstAmt) ? 0 : gstAmt,
      note: billNote.trim() || null,
    });

    if (res.error) {
      setActionError(res.error);
      setIsSubmitting(false);
      return;
    }

    // Optional doc upload
    if (billDocFile) {
      const formData = new FormData();
      formData.append("file", billDocFile);
      formData.append("project_id", projectId);
      formData.append("category", "bill");
      formData.append("title", `Bill ${billNumber} - ${billVendorName}`);
      await uploadDocumentAction(null, formData);
    }

    setIsSubmitting(false);
    setIsCreateBillModalOpen(false);
    setBillNumber("");
    setBillVendorName("");
    setBillAmountExclGst("");
    setBillGstAmount("0");
    setBillLinkedOrderId("");
    setBillNote("");
    setBillDocFile(null);
    router.refresh();
  }

  // Cancel Bill (Rule F13 soft delete)
  async function handleCancelBill(bill: BillItem) {
    if (!canManageBills) return;
    const confirm = window.confirm(
      `Cancel Bill ${bill.bill_number} from ${bill.vendor_name}? This soft-cancels the bill and excludes it from payables, aging, and cost calculations.`
    );
    if (!confirm) return;

    setIsSubmitting(true);
    setActionError(null);

    const res = await cancelBillAction(bill.id, projectId);
    setIsSubmitting(false);

    if (res.error) {
      setActionError(res.error);
    } else {
      router.refresh();
    }
  }

  // Open Record Payment Modal
  function openRecordPaymentModal(bill: BillItem) {
    setSelectedBillForPayment(bill);
    const calc = getBillOutstandingPaise(bill);
    setPaymentDate(todayStr);
    setPaymentAmountPaid((calc.outstandingPaise / 100).toFixed(2));
    setPaymentTdsAmount("0");
    setPaymentMode("bank_transfer");
    setPaymentRef("");
    setPaymentNote("");
    setIsRecordPaymentModalOpen(true);
  }

  // Record Bill Payment
  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBillForPayment || !canManageBills) return;
    setIsSubmitting(true);
    setActionError(null);

    const paidVal = parseFloat(paymentAmountPaid);
    const tdsVal = parseFloat(paymentTdsAmount || "0");

    if (isNaN(paidVal) || paidVal <= 0) {
      setActionError("Amount paid must be greater than 0");
      setIsSubmitting(false);
      return;
    }

    const totalSettlingPaise = rupeesToPaise(paidVal) + rupeesToPaise(isNaN(tdsVal) ? 0 : tdsVal);
    const calc = getBillOutstandingPaise(selectedBillForPayment);

    if (totalSettlingPaise > calc.outstandingPaise) {
      setActionError(
        `Total settlement (Paid + TDS = ${formatPaise(
          totalSettlingPaise
        )}) exceeds outstanding balance (${formatPaise(calc.outstandingPaise)})`
      );
      setIsSubmitting(false);
      return;
    }

    const res = await createBillPaymentAction({
      billId: selectedBillForPayment.id,
      projectId,
      paymentDate,
      amountPaid: paidVal,
      tdsAmount: isNaN(tdsVal) ? 0 : tdsVal,
      mode: paymentMode,
      reference: paymentRef.trim() || null,
      note: paymentNote.trim() || null,
    });

    setIsSubmitting(false);
    if (res.error) {
      setActionError(res.error);
    } else {
      setIsRecordPaymentModalOpen(false);
      setSelectedBillForPayment(null);
      router.refresh();
    }
  }

  // Open Attach Document Modal
  function openAttachDocModal(type: "order" | "bill", id: string, label: string) {
    setDocTarget({ type, id, label });
    setAttachFile(null);
    setAttachDocTitle(`${type === "order" ? "PO" : "Bill"} - ${label}`);
    setIsAttachDocModalOpen(true);
  }

  // Handle Attach Document
  async function handleAttachDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!docTarget || !attachFile) return;
    setIsSubmitting(true);
    setActionError(null);

    const formData = new FormData();
    formData.append("file", attachFile);
    formData.append("project_id", projectId);
    formData.append("category", docTarget.type === "order" ? "purchase_order" : "bill");
    formData.append("title", attachDocTitle.trim() || docTarget.label);

    if (docTarget.type === "order") {
      formData.append("vendor_order_id", docTarget.id);
    } else {
      formData.append("bill_id", docTarget.id);
    }

    const res = await uploadDocumentAction(null, formData);
    setIsSubmitting(false);

    if (res.error) {
      setActionError(res.error);
    } else {
      setIsAttachDocModalOpen(false);
      setDocTarget(null);
      setAttachFile(null);
      router.refresh();
    }
  }

  // Compute late orders count for KPI badge
  const lateOrdersCount = costData.orders.filter((ord) => {
    const check = isVendorOrderLate(ord, todayStr);
    return check.isTrouble;
  }).length;

  return (
    <div className="space-y-8">
      {actionError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-red-400 hover:text-red-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TOP KPI ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Budget */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              Budget (Ex-GST)
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              {costData.budgetLines.length} categories
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            {formatPaise(costData.summary.totalBudgetPaise)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Baseline cost estimate</span>
            {canManageBudget && (
              <button
                onClick={() => setIsBudgetModalOpen(true)}
                className="text-blue-400 hover:text-blue-300 font-medium cursor-pointer inline-flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3" /> Edit
              </button>
            )}
          </div>
        </div>

        {/* Total Committed */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
              Committed (Orders)
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              {costData.orders.length} orders
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">
            {formatPaise(costData.summary.totalCommittedPaise)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Vendor POs issued</span>
            {lateOrdersCount > 0 ? (
              <span className="text-red-400 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {lateOrdersCount} late
              </span>
            ) : (
              <span className="text-slate-500">All on track</span>
            )}
          </div>
        </div>

        {/* Total Billed */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-indigo-400" />
              Billed (Ex-GST)
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              {costData.bills.length} bills
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            {formatPaise(costData.summary.totalBilledPaise)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Settled: {formatPaise(costData.summary.totalSettledPaise)}</span>
            <span className="text-slate-500">Paid: {formatPaise(costData.summary.totalPaidPaise)}</span>
          </div>
        </div>

        {/* Forecast Cost (Rule F8) */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium flex items-center gap-1.5">
              <IndianRupee className="w-3.5 h-3.5 text-emerald-400" />
              Forecast Cost
            </span>
            {costData.summary.hasOverrun && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                Overrun
              </span>
            )}
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {formatPaise(costData.summary.totalForecastCostPaise)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Category forecast</span>
            {costData.summary.hasOverrun ? (
              <span className="text-red-400 font-mono text-[10px]">
                +{formatPaise(costData.summary.totalOverrunPaise)}
              </span>
            ) : (
              <span className="text-emerald-400 font-mono text-[10px]">On budget</span>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 1: VENDOR ORDERS */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden backdrop-blur-sm">
        <div className="p-5 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber-400" />
              Vendor Orders &amp; Subcontracts
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                {costData.orders.length}
              </span>
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {canManageOrders && (
              <button
                onClick={() => setIsCreateOrderModalOpen(true)}
                className="px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-blue-600/25"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Vendor Order</span>
              </button>
            )}
          </div>
        </div>

        {costData.orders.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
            <p>No vendor orders or subcontracts recorded for this project yet.</p>
            {canManageOrders && (
              <button
                onClick={() => setIsCreateOrderModalOpen(true)}
                className="mt-3 text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Issue first order
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-[11px] uppercase font-mono">
                <tr>
                  <th className="py-3 px-4">Description / Vendor</th>
                  <th className="py-3 px-4">Category &amp; Kind</th>
                  <th className="py-3 px-4">Expected Delivery</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Amount (Ex-GST)</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4">Document</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {costData.orders.map((ord) => {
                  const late = isVendorOrderLate(ord, todayStr);
                  const statusConfig = FULFILMENT_STATUS_LABELS[ord.fulfilment_status] || {
                    label: ord.fulfilment_status,
                    color: "bg-slate-800 text-slate-400",
                  };
                  const totalPaise =
                    rupeesToPaise(ord.amount_excl_gst) + rupeesToPaise(ord.gst_amount || 0);
                  const doc = ord.documents?.[0];

                  return (
                    <tr
                      key={ord.id}
                      className={`hover:bg-slate-800/30 transition ${
                        late.isTrouble ? "bg-red-500/5" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-100">{ord.description}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Truck className="w-3 h-3 text-slate-500" />
                          <span>{ord.vendor_name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200">
                          {ord.cost_categories?.name || "General"}
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase">
                          {ORDER_KIND_LABELS[ord.kind] || ord.kind}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-300 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {ord.expected_delivery_date}
                        </div>
                        {late.isLate && (
                          <div className="text-[10px] font-semibold text-red-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" /> {late.daysLate}d late
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusConfig.color}`}
                        >
                          {statusConfig.label}
                        </span>
                        {ord.delivery_note && (
                          <div
                            className="text-[10px] text-slate-400 mt-1 max-w-[180px] truncate"
                            title={ord.delivery_note}
                          >
                            {ord.delivery_note}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-200">
                        {formatPaise(rupeesToPaise(ord.amount_excl_gst))}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-amber-400">
                        {formatPaise(totalPaise)}
                      </td>
                      <td className="py-3 px-4">
                        {doc ? (
                          <button
                            onClick={() => handleDownloadDoc(doc.id)}
                            disabled={downloadingDocId === doc.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition cursor-pointer"
                            title={doc.title}
                          >
                            {downloadingDocId === doc.id ? (
                              <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                            ) : (
                              <Download className="w-3 h-3 text-slate-400" />
                            )}
                            <span className="truncate max-w-[80px]">PO Doc</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canManageOrders && (
                            <button
                              onClick={() => openUpdateOrderModal(ord)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition cursor-pointer"
                              title="Update delivery status & date"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!doc && (
                            <button
                              onClick={() =>
                                openAttachDocModal(
                                  "order",
                                  ord.id,
                                  `${ord.vendor_name} - ${(ord.description || "").slice(0, 20)}`
                                )
                              }
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                              title="Attach PO Document"
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 2: BILLS & EXPENSES */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden backdrop-blur-sm">
        <div className="p-5 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-400" />
              Bills &amp; Expenses (Payables)
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                {costData.bills.length}
              </span>
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {canManageBills && (
              <button
                onClick={() => setIsCreateBillModalOpen(true)}
                className="px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-blue-600/25"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Enter Bill / Expense</span>
              </button>
            )}
          </div>
        </div>

        {costData.bills.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
            <p>No vendor bills or direct expenses entered for this project yet.</p>
            {canManageBills && (
              <button
                onClick={() => setIsCreateBillModalOpen(true)}
                className="mt-3 text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Enter first bill
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-[11px] uppercase font-mono">
                <tr>
                  <th className="py-3 px-4">Bill # / Vendor</th>
                  <th className="py-3 px-4">Category &amp; Link</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4 text-right">Ex-GST</th>
                  <th className="py-3 px-4 text-right">Total Bill</th>
                  <th className="py-3 px-4 text-right">Settled (Paid+TDS)</th>
                  <th className="py-3 px-4 text-right">Outstanding</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Document</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {costData.bills.map((bill) => {
                  const calc = getBillOutstandingPaise(bill);
                  const doc = bill.documents?.[0];

                  return (
                    <tr
                      key={bill.id}
                      className={`hover:bg-slate-800/30 transition ${
                        bill.is_cancelled
                          ? "opacity-50 bg-slate-900/40"
                          : calc.isOverdue
                          ? "bg-red-500/5"
                          : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                          <span>{bill.bill_number}</span>
                          {bill.is_cancelled && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-800 text-slate-500 border border-slate-700">
                              CANCELLED
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{bill.vendor_name}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200">
                          {bill.cost_categories?.name || "General"}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {bill.vendor_orders?.description ? (
                            <span className="text-blue-400">
                              Linked: {bill.vendor_orders.description.slice(0, 18)}...
                            </span>
                          ) : (
                            <span className="text-slate-500">Direct Expense</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <div className="text-slate-300">{bill.bill_date}</div>
                        <div className="text-slate-500 text-[10px]">Due: {bill.due_date}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        {formatPaise(rupeesToPaise(bill.amount_excl_gst))}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-100">
                        {formatPaise(calc.totalPaise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400">
                        {formatPaise(calc.settledPaise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                        {formatPaise(calc.outstandingPaise)}
                      </td>
                      <td className="py-3 px-4">
                        {bill.is_cancelled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                            <Ban className="w-3 h-3" /> Cancelled
                          </span>
                        ) : calc.outstandingPaise === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> Settled
                          </span>
                        ) : calc.isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                            <AlertTriangle className="w-3 h-3" /> Overdue
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <Clock className="w-3 h-3" /> Current
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {doc ? (
                          <button
                            onClick={() => handleDownloadDoc(doc.id)}
                            disabled={downloadingDocId === doc.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition cursor-pointer"
                            title={doc.title}
                          >
                            {downloadingDocId === doc.id ? (
                              <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                            ) : (
                              <Download className="w-3 h-3 text-slate-400" />
                            )}
                            <span className="truncate max-w-[80px]">Bill Doc</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!bill.is_cancelled && calc.outstandingPaise > 0 && canManageBills && (
                            <button
                              onClick={() => openRecordPaymentModal(bill)}
                              className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium transition cursor-pointer"
                              title="Record payment against this bill"
                            >
                              Pay
                            </button>
                          )}
                          {!bill.is_cancelled && canManageBills && (
                            <button
                              onClick={() => handleCancelBill(bill)}
                              className="p-1 rounded bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition cursor-pointer"
                              title="Cancel bill"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!doc && (
                            <button
                              onClick={() =>
                                openAttachDocModal(
                                  "bill",
                                  bill.id,
                                  `${bill.bill_number} - ${bill.vendor_name}`
                                )
                              }
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                              title="Attach Bill Document"
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}

      {/* 1. EDIT BUDGET MODAL (Director Only) */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-400" />
                  Edit Project Budget Lines
                </h3>
              </div>
              <button
                onClick={() => setIsBudgetModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-3">
                {budgetFormLines.map((line, idx) => (
                  <div
                    key={line.categoryId}
                    className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    <div className="sm:w-1/3">
                      <div className="text-xs font-semibold text-slate-200">
                        {line.categoryName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">Category ID</div>
                    </div>
                    <div className="sm:w-1/3">
                      <label className="text-[10px] text-slate-400 uppercase font-mono block mb-1">
                        Budget (₹ Ex-GST)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={line.amount}
                        onChange={(e) => {
                          const updated = [...budgetFormLines];
                          updated[idx].amount = e.target.value;
                          setBudgetFormLines(updated);
                        }}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs font-mono focus:border-blue-400 focus:outline-none"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="sm:w-1/3">
                      <label className="text-[10px] text-slate-400 uppercase font-mono block mb-1">
                        Notes / Assumptions
                      </label>
                      <input
                        type="text"
                        value={line.note}
                        onChange={(e) => {
                          const updated = [...budgetFormLines];
                          updated[idx].note = e.target.value;
                          setBudgetFormLines(updated);
                        }}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:border-blue-400 focus:outline-none"
                        placeholder="Optional note"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-center justify-between">
                <span>Total Budget:</span>
                <span className="font-mono font-bold text-sm">
                  {formatPaise(
                    budgetFormLines.reduce((acc, l) => {
                      const v = parseFloat(l.amount) || 0;
                      return acc + rupeesToPaise(v);
                    }, 0)
                  )}
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBudgetModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-500/20"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Budget Lines</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. CREATE VENDOR ORDER MODAL */}
      {isCreateOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-amber-400" />
                  Create Vendor Order / Subcontract
                </h3>
              </div>
              <button
                onClick={() => setIsCreateOrderModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    Cost Category *
                  </label>
                  <select
                    value={orderCategory}
                    onChange={(e) => setOrderCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-amber-400 focus:outline-none"
                    required
                  >
                    {costData.categories
                      .filter((c) => c.is_active)
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    Order Kind *
                  </label>
                  <select
                    value={orderKind}
                    onChange={(e) => setOrderKind(e.target.value as OrderKind)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-amber-400 focus:outline-none"
                    required
                  >
                    <option value="material">Material PO</option>
                    <option value="fabrication">Fabrication Subcontract</option>
                    <option value="subcontract">Civil / Site Subcontract</option>
                    <option value="service">Engineering / Testing Service</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    Vendor / Contractor Name *
                  </label>
                  <input
                    type="text"
                    value={orderVendorName}
                    onChange={(e) => setOrderVendorName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-amber-400 focus:outline-none"
                    placeholder="e.g., Jindal Steel & Power Ltd"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    Order Description *
                  </label>
                  <input
                    type="text"
                    value={orderDesc}
                    onChange={(e) => setOrderDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-amber-400 focus:outline-none"
                    placeholder="e.g., ISMB 300 Beams - Lot 1 (45 MT)"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    Amount (₹ Ex-GST) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={orderAmountExclGst}
                    onChange={(e) => setOrderAmountExclGst(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-amber-400 focus:outline-none"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    GST Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={orderGstAmount}
                    onChange={(e) => setOrderGstAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-amber-400 focus:outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    Order Date *
                  </label>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-amber-400 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    Expected Delivery Date *
                  </label>
                  <input
                    type="date"
                    value={orderExpectedDelivery}
                    onChange={(e) => setOrderExpectedDelivery(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-amber-400 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Fulfilment Status
                </label>
                <select
                  value={orderStatus}
                  onChange={(e) => setOrderStatus(e.target.value as FulfilmentStatus)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-amber-400 focus:outline-none"
                >
                  <option value="ordered">Ordered (PO Issued)</option>
                  <option value="in_progress">In Progress / In Fabrication</option>
                  <option value="partially_fulfilled">Partially Fulfilled</option>
                  <option value="fulfilled">Fulfilled / Delivered</option>
                  <option value="issue">Delivery Issue / Delayed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Delivery Notes / Specs
                </label>
                <textarea
                  value={orderDeliveryNote}
                  onChange={(e) => setOrderDeliveryNote(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-amber-400 focus:outline-none"
                  placeholder="Dispatch location, mill certificates required, packaging terms..."
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Attach Purchase Order Document (Optional)
                </label>
                <input
                  type="file"
                  onChange={(e) => setOrderDocFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOrderModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Order...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Issue Vendor Order</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. UPDATE ORDER STATUS & DELIVERY MODAL */}
      {isUpdateOrderModalOpen && selectedOrderForUpdate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-amber-400" />
                  Update Order Delivery
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">
                  {selectedOrderForUpdate.vendor_name} — {selectedOrderForUpdate.description}
                </p>
              </div>
              <button
                onClick={() => setIsUpdateOrderModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateOrderDelivery} className="p-5 space-y-4">
              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Fulfilment Status *
                </label>
                <select
                  value={updateOrderStatus}
                  onChange={(e) => setUpdateOrderStatus(e.target.value as FulfilmentStatus)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-amber-400 focus:outline-none"
                  required
                >
                  <option value="ordered">Ordered (PO Issued)</option>
                  <option value="in_progress">In Progress</option>
                  <option value="partially_fulfilled">Partially Fulfilled</option>
                  <option value="fulfilled">Fulfilled / Delivered</option>
                  <option value="issue">Delivery Issue / Delay</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Expected Delivery Date *
                </label>
                <input
                  type="date"
                  value={updateOrderDeliveryDate}
                  onChange={(e) => setUpdateOrderDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-amber-400 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Status Remarks / Issue Reason
                </label>
                <textarea
                  value={updateOrderNote}
                  onChange={(e) => setUpdateOrderNote(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-amber-400 focus:outline-none"
                  placeholder="Explain dispatch status, delay reason, or partial quantities received..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUpdateOrderModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Update Delivery</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. ENTER BILL / EXPENSE MODAL */}
      {isCreateBillModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-indigo-400" />
                  Enter Vendor Bill or Expense
                </h3>
              </div>
              <button
                onClick={() => setIsCreateBillModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBill} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    Cost Category *
                  </label>
                  <select
                    value={billCategory}
                    onChange={(e) => setBillCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-indigo-400 focus:outline-none"
                    required
                  >
                    {costData.categories
                      .filter((c) => c.is_active)
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    Bill Type *
                  </label>
                  <select
                    value={billType}
                    onChange={(e) => setBillType(e.target.value as BillType)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-indigo-400 focus:outline-none"
                    required
                  >
                    <option value="supplier_bill">Supplier Material Invoice</option>
                    <option value="subcontractor_bill">Subcontractor RA Bill</option>
                    <option value="direct_expense">Direct Expense / Fuel / Testing</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Linked Vendor Order (Optional)
                </label>
                <select
                  value={billLinkedOrderId}
                  onChange={(e) => setBillLinkedOrderId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-indigo-400 focus:outline-none"
                >
                  <option value="">None (Direct Site Expense / Unlinked)</option>
                  {costData.orders
                    .filter((o) => o.fulfilment_status !== "cancelled")
                    .map((ord) => (
                      <option key={ord.id} value={ord.id}>
                        {ord.vendor_name} — {ord.description} (₹{ord.amount_excl_gst})
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Linking a bill to an order marks the order as fulfilled/billed against committed budget.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    Vendor / Payee Name *
                  </label>
                  <input
                    type="text"
                    value={billVendorName}
                    onChange={(e) => setBillVendorName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-indigo-400 focus:outline-none"
                    placeholder="e.g., Tata Steel Limited"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    Vendor Bill / Invoice # *
                  </label>
                  <input
                    type="text"
                    value={billNumber}
                    onChange={(e) => setBillNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-indigo-400 focus:outline-none"
                    placeholder="e.g., TS-2026-8891"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    Bill Date *
                  </label>
                  <input
                    type="date"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-indigo-400 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    Payment Due Date *
                  </label>
                  <input
                    type="date"
                    value={billDueDate}
                    onChange={(e) => setBillDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-indigo-400 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    Amount (₹ Ex-GST) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={billAmountExclGst}
                    onChange={(e) => setBillAmountExclGst(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-indigo-400 focus:outline-none"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    GST Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={billGstAmount}
                    onChange={(e) => setBillGstAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-indigo-400 focus:outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Notes / Particulars
                </label>
                <textarea
                  value={billNote}
                  onChange={(e) => setBillNote(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-indigo-400 focus:outline-none"
                  placeholder="LR number, weighbridge slip reference, payment terms..."
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Attach Vendor Bill Scan / PDF (Optional)
                </label>
                <input
                  type="file"
                  onChange={(e) => setBillDocFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateBillModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/20"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Bill...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Record Bill</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. RECORD BILL PAYMENT MODAL */}
      {isRecordPaymentModalOpen && selectedBillForPayment && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <IndianRupee className="w-5 h-5 text-emerald-400" />
                  Record Bill Payment
                </h3>
              </div>
              <button
                onClick={() => setIsRecordPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-5 space-y-4">
              {/* Bill Details Summary Card */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Bill Number:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {selectedBillForPayment.bill_number}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Vendor:</span>
                  <span className="text-slate-200">{selectedBillForPayment.vendor_name}</span>
                </div>
                {(() => {
                  const c = getBillOutstandingPaise(selectedBillForPayment);
                  return (
                    <>
                      <div className="flex justify-between border-t border-slate-800 pt-1 text-[11px]">
                        <span className="text-slate-400">Total Bill (with GST):</span>
                        <span className="font-mono text-slate-200">
                          {formatPaise(c.totalPaise)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Settled (Paid + TDS):</span>
                        <span className="font-mono text-emerald-400">
                          {formatPaise(c.settledPaise)}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-xs text-amber-400">
                        <span>Outstanding:</span>
                        <span className="font-mono">{formatPaise(c.outstandingPaise)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-emerald-400 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    Payment Mode *
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-emerald-400 focus:outline-none"
                    required
                  >
                    <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="cheque">Cheque</option>
                    <option value="upi">UPI</option>
                    <option value="cash">Cash</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    Amount Paid (₹ Cash) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={paymentAmountPaid}
                    onChange={(e) => setPaymentAmountPaid(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-emerald-400 focus:outline-none"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">
                    TDS Deducted (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={paymentTdsAmount}
                    onChange={(e) => setPaymentTdsAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-emerald-400 focus:outline-none"
                    placeholder="0.00"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    TDS is settled against bill liability
                  </p>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Bank Reference / UTR Number
                </label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-emerald-400 focus:outline-none"
                  placeholder="e.g., UTR-HDFC-202610189912"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Payment Note / Remarks
                </label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-emerald-400 focus:outline-none"
                  placeholder="Optional internal remark"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRecordPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Record Payment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. ATTACH DOCUMENT MODAL */}
      {isAttachDocModalOpen && docTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Paperclip className="w-5 h-5 text-amber-400" />
                  Attach Document
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{docTarget.label}</p>
              </div>
              <button
                onClick={() => setIsAttachDocModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAttachDoc} className="p-5 space-y-4">
              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Document Title *
                </label>
                <input
                  type="text"
                  value={attachDocTitle}
                  onChange={(e) => setAttachDocTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-amber-400 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Select File (PDF, Image) *
                </label>
                <input
                  type="file"
                  onChange={(e) => setAttachFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAttachDocModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !attachFile}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Upload &amp; Attach</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
