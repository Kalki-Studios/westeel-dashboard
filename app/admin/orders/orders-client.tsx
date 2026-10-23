"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  OrderKind,
  FulfilmentStatus,
  CostCategory,
} from "@/lib/costs/types";
import {
  createVendorOrderAction,
  updateVendorOrderStatusAction,
} from "@/lib/costs/actions";
import { uploadDocumentAction, getSignedDocumentUrlAction } from "@/lib/documents/actions";
import { formatPaise, rupeesToPaise } from "@/lib/money";
import {
  ShoppingBag,
  Truck,
  Plus,
  Edit2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Loader2,
  Check,
  X,
  Download,
  Building2,
  Layers,
  Paperclip,
} from "lucide-react";

export interface QueueOrderItem {
  id: string;
  project_id: string;
  category_id: string;
  kind: OrderKind;
  vendor_name: string;
  description: string;
  amount_excl_gst: number;
  gst_amount: number;
  order_date: string;
  expected_delivery_date: string;
  fulfilment_status: FulfilmentStatus;
  delivery_note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  projectCode: string;
  projectName: string;
  categoryName: string;
  createdByName: string;
  isLate: boolean;
  isIssue: boolean;
  isTrouble: boolean;
  daysLate: number;
}

interface OrdersClientProps {
  orders: QueueOrderItem[];
  categories: CostCategory[];
  projects: Array<{ id: string; code: string; name: string }>;
  isDirector: boolean;
  isPurchase?: boolean;
  baseHref?: string; // e.g. "/x9admin" or "/employee"
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

function getDefaultDates() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const delivery = new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10);
  return { today, delivery };
}

export function OrdersClient({
  orders,
  categories,
  projects,
  isDirector,
  isPurchase = false,
  baseHref = "/x9admin",
}: OrdersClientProps) {
  const router = useRouter();
  const [defaultDates] = useState(getDefaultDates);
  const canManageOrders = isDirector || isPurchase;

  const todayStr = defaultDates.today;
  const defaultDeliveryDate = defaultDates.delivery;

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedOrderForUpdate, setSelectedOrderForUpdate] = useState<QueueOrderItem | null>(null);

  // Create Form State
  const [orderProjectId, setOrderProjectId] = useState(projects[0]?.id || "");
  const [orderCategory, setOrderCategory] = useState(categories.find((c) => c.is_active)?.id || "");
  const [orderKind, setOrderKind] = useState<OrderKind>("material");
  const [orderVendorName, setOrderVendorName] = useState("");
  const [orderDesc, setOrderDesc] = useState("");
  const [orderAmountExclGst, setOrderAmountExclGst] = useState("");
  const [orderGstAmount, setOrderGstAmount] = useState("0");
  const [orderDate, setOrderDate] = useState(todayStr);
  const [orderExpectedDelivery, setOrderExpectedDelivery] = useState(defaultDeliveryDate);
  const [orderStatus, setOrderStatus] = useState<FulfilmentStatus>("ordered");
  const [orderDeliveryNote, setOrderDeliveryNote] = useState("");

  // Update Form State
  const [updateOrderStatus, setUpdateOrderStatus] = useState<FulfilmentStatus>("ordered");
  const [updateOrderDeliveryDate, setUpdateOrderDeliveryDate] = useState("");
  const [updateOrderNote, setUpdateOrderNote] = useState("");

  // Loading & error
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filtered orders
  const query = searchQuery.toLowerCase().trim();

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Search
      if (query) {
        const matchesQuery =
          o.description.toLowerCase().includes(query) ||
          o.vendor_name.toLowerCase().includes(query) ||
          o.projectCode.toLowerCase().includes(query) ||
          o.projectName.toLowerCase().includes(query);
        if (!matchesQuery) return false;
      }

      // Status
      if (statusFilter === "late_issue") {
        if (!o.isTrouble) return false;
      } else if (statusFilter !== "all" && o.fulfilment_status !== statusFilter) {
        return false;
      }

      // Kind
      if (kindFilter !== "all" && o.kind !== kindFilter) {
        return false;
      }

      // Project
      if (projectFilter !== "all" && o.project_id !== projectFilter) {
        return false;
      }

      return true;
    });
  }, [orders, query, statusFilter, kindFilter, projectFilter]);

  // Aggregate stats
  const totalOrdersCount = orders.length;
  const lateOrdersCount = orders.filter((o) => o.isTrouble).length;
  const inProgressCount = orders.filter(
    (o) => o.fulfilment_status === "in_progress" || o.fulfilment_status === "ordered"
  ).length;
  const totalCommittedPaise = orders
    .filter((o) => o.fulfilment_status !== "cancelled")
    .reduce((acc, o) => acc + rupeesToPaise(o.amount_excl_gst), 0);

  // Handlers
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
      projectId: orderProjectId,
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

    setIsSubmitting(false);
    if (res.error) {
      setActionError(res.error);
    } else {
      setIsCreateModalOpen(false);
      setOrderVendorName("");
      setOrderDesc("");
      setOrderAmountExclGst("");
      setOrderGstAmount("0");
      setOrderDeliveryNote("");
      router.refresh();
    }
  }

  function openUpdateModal(order: QueueOrderItem) {
    setSelectedOrderForUpdate(order);
    setUpdateOrderStatus(order.fulfilment_status);
    setUpdateOrderDeliveryDate(order.expected_delivery_date);
    setUpdateOrderNote(order.delivery_note || "");
    setActionError(null);
    setIsUpdateModalOpen(true);
  }

  async function handleUpdateOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrderForUpdate || !canManageOrders) return;
    setIsSubmitting(true);
    setActionError(null);

    const res = await updateVendorOrderStatusAction(
      selectedOrderForUpdate.id,
      selectedOrderForUpdate.project_id,
      updateOrderStatus,
      updateOrderDeliveryDate,
      updateOrderNote.trim() || null
    );

    setIsSubmitting(false);
    if (res.error) {
      setActionError(res.error);
    } else {
      setIsUpdateModalOpen(false);
      setSelectedOrderForUpdate(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-amber-400" />
            Vendor Orders &amp; Purchase Queue
          </h1>
        </div>

        {canManageOrders && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer self-start sm:self-auto shadow-md shadow-blue-600/25"
          >
            <Plus className="w-4 h-4" />
            <span>Create Vendor Order</span>
          </button>
        )}
      </div>

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

      {/* KPI ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Orders */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mb-1">
            <ShoppingBag className="w-3.5 h-3.5 text-blue-400" />
            Total Orders Placed
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">{totalOrdersCount}</div>
          <div className="mt-2 text-[11px] text-slate-400">
            Across {projects.length} active projects
          </div>
        </div>

        {/* Late Orders / Issues (Rule R9) */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
          <div className="text-xs text-slate-400 font-medium flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              Late Orders / Issues
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-red-400">{lateOrdersCount}</div>
          <div className="mt-2 text-[11px] text-slate-400">
            {lateOrdersCount > 0
              ? "Past delivery date or flagged issue"
              : "All active deliveries on schedule"}
          </div>
        </div>

        {/* In Progress */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Active / In Progress
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">{inProgressCount}</div>
          <div className="mt-2 text-[11px] text-slate-400">Ordered or in fabrication</div>
        </div>

        {/* Total Committed Value */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mb-1">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            Total Value Committed
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {formatPaise(totalCommittedPaise)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">Ex-GST purchase commitments</div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vendor, description..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:border-amber-400 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="late_issue">Late / Issues Only</option>
            <option value="ordered">Ordered (PO Issued)</option>
            <option value="in_progress">In Progress</option>
            <option value="partially_fulfilled">Partially Fulfilled</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="issue">Delivery Issue</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Kind Filter */}
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:border-amber-400 focus:outline-none"
          >
            <option value="all">All Order Types</option>
            <option value="material">Material</option>
            <option value="fabrication">Fabrication</option>
            <option value="subcontract">Subcontract</option>
            <option value="service">Service</option>
          </select>

          {/* Project Filter */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:border-amber-400 focus:outline-none"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ORDERS QUEUE TABLE */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden backdrop-blur-sm">
        {filteredOrders.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs">
            <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
            <p>No vendor orders found matching your filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-[11px] uppercase font-mono">
                <tr>
                  <th className="py-3 px-4">Description / Vendor</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Category &amp; Kind</th>
                  <th className="py-3 px-4">Expected Delivery</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Amount (Ex-GST)</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredOrders.map((ord) => {
                  const statusConfig = FULFILMENT_STATUS_LABELS[ord.fulfilment_status] || {
                    label: ord.fulfilment_status,
                    color: "bg-slate-800 text-slate-400",
                  };
                  const totalPaise =
                    rupeesToPaise(ord.amount_excl_gst) + rupeesToPaise(ord.gst_amount || 0);

                  return (
                    <tr
                      key={ord.id}
                      className={`hover:bg-slate-800/30 transition ${
                        ord.isTrouble ? "bg-red-500/5" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-100">{ord.description}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Truck className="w-3 h-3 text-slate-500" />
                          <span>{ord.vendor_name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          href={`${baseHref}/projects/${ord.project_id}?tab=orders`}
                          className="font-medium text-slate-200 hover:text-amber-400 transition"
                        >
                          {ord.projectName}
                        </Link>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          {ord.projectCode}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200">{ord.categoryName}</div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase">
                          {ORDER_KIND_LABELS[ord.kind] || ord.kind}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-300 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {ord.expected_delivery_date}
                        </div>
                        {ord.isLate && (
                          <div className="text-[10px] font-semibold text-red-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" /> {ord.daysLate}d late
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
                            className="text-[10px] text-slate-400 mt-1 max-w-[160px] truncate"
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
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canManageOrders && (
                            <button
                              onClick={() => openUpdateModal(ord)}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 text-xs transition cursor-pointer"
                              title="Update delivery status & date"
                            >
                              Update
                            </button>
                          )}
                          <Link
                            href={`${baseHref}/projects/${ord.project_id}?tab=orders`}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
                            title="View in project orders tab"
                          >
                            <Building2 className="w-3.5 h-3.5" />
                          </Link>
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

      {/* CREATE ORDER MODAL */}
      {isCreateModalOpen && (
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
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Project *
                </label>
                <select
                  value={orderProjectId}
                  onChange={(e) => setOrderProjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-amber-400 focus:outline-none"
                  required
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

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
                    {categories
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
                  <option value="in_progress">In Progress</option>
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

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
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

      {/* UPDATE ORDER MODAL */}
      {isUpdateModalOpen && selectedOrderForUpdate && (
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
                onClick={() => setIsUpdateModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateOrder} className="p-5 space-y-4">
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
                  onClick={() => setIsUpdateModalOpen(false)}
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
    </div>
  );
}
