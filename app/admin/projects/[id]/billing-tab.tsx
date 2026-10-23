"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectBillingData, VariationStatus, PaymentMode } from "@/lib/billing/types";
import {
  updateProjectCommercialsAction,
  createVariationOrderAction,
  updateVariationStatusAction,
  createPaymentMilestoneAction,
  updatePaymentMilestoneAction,
  deletePaymentMilestoneAction,
  createInvoiceAction,
  cancelInvoiceAction,
  createReceiptAction,
  allocateReceiptAction,
  updateReceiptAction,
} from "@/lib/billing/actions";
import { uploadDocumentAction, getSignedDocumentUrlAction } from "@/lib/documents/actions";
import { formatPaise } from "@/lib/money";
import {
  IndianRupee,
  Clock,
  AlertTriangle,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Calendar,
  Layers,
  FileText,
  Upload,
  Download,
  Check,
  X,
  Loader2,
  ArrowRight,
  CreditCard,
  Ban,
  Paperclip,
} from "lucide-react";

function getDefaultDates() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const due = new Date(now.getTime() + 15 * 86400000).toISOString().slice(0, 10);
  return { today, due };
}

interface BillingTabProps {
  projectId: string;
  projectCode: string;
  projectName: string;
  billingData: ProjectBillingData;
  isDirector: boolean;
}

export function BillingTab({
  projectId,
  projectCode,
  projectName,
  billingData,
  isDirector,
}: BillingTabProps) {
  const router = useRouter();
  const [defaultDates] = useState(getDefaultDates);

  // Modals
  const [isContractValueModalOpen, setIsContractValueModalOpen] = useState(false);
  const [isAddVariationModalOpen, setIsAddVariationModalOpen] = useState(false);
  const [isAddMilestoneModalOpen, setIsAddMilestoneModalOpen] = useState(false);
  const [isCreateInvoiceModalOpen, setIsCreateInvoiceModalOpen] = useState(false);
  const [isRecordReceiptModalOpen, setIsRecordReceiptModalOpen] = useState(false);
  const [isAttachDocModalOpen, setIsAttachDocModalOpen] = useState(false);
  const [targetInvoiceIdForDoc, setTargetInvoiceIdForDoc] = useState<string | null>(null);

  // Loading & error
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Contract value form
  const [contractValueInput, setContractValueInput] = useState<string>(
    billingData.commercials ? String(billingData.commercials.contract_value_excl_gst) : "0"
  );

  // Handlers
  async function handleUpdateContractValue(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setActionError(null);

    const val = parseFloat(contractValueInput);
    if (isNaN(val) || val < 0) {
      setActionError("Please enter a valid non-negative contract value");
      setIsSubmitting(false);
      return;
    }

    const res = await updateProjectCommercialsAction(projectId, val);
    if (res.error) {
      setActionError(res.error);
    } else {
      setIsContractValueModalOpen(false);
      router.refresh();
    }
    setIsSubmitting(false);
  }

  async function handleCreateVariation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setActionError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("projectId", projectId);

    const res = await createVariationOrderAction(formData);
    if (res.error) {
      setActionError(res.error);
    } else {
      setIsAddVariationModalOpen(false);
      router.refresh();
    }
    setIsSubmitting(false);
  }

  async function handleUpdateVariationStatus(
    variationId: string,
    status: VariationStatus
  ) {
    setIsSubmitting(true);
    setActionError(null);

    const res = await updateVariationStatusAction(variationId, projectId, status);
    if (res.error) {
      setActionError(res.error);
    } else {
      router.refresh();
    }
    setIsSubmitting(false);
  }

  async function handleCreateMilestone(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setActionError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("projectId", projectId);

    const res = await createPaymentMilestoneAction(formData);
    if (res.error) {
      setActionError(res.error);
    } else {
      setIsAddMilestoneModalOpen(false);
      router.refresh();
    }
    setIsSubmitting(false);
  }

  async function handleDeleteMilestone(milestoneId: string) {
    if (!confirm("Are you sure you want to delete this payment milestone?")) return;
    setIsSubmitting(true);
    setActionError(null);

    const res = await deletePaymentMilestoneAction(milestoneId, projectId);
    if (res.error) {
      setActionError(res.error);
    } else {
      router.refresh();
    }
    setIsSubmitting(false);
  }

  async function handleCreateInvoice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setActionError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("projectId", projectId);

    const res = await createInvoiceAction(formData);
    if (res.error) {
      setActionError(res.error);
    } else {
      setIsCreateInvoiceModalOpen(false);
      router.refresh();
    }
    setIsSubmitting(false);
  }

  async function handleCancelInvoice(invoiceId: string, invoiceNumber: string) {
    if (
      !confirm(
        `Are you sure you want to CANCEL Invoice ${invoiceNumber}? It will be marked cancelled and excluded from calculations.`
      )
    )
      return;

    setIsSubmitting(true);
    setActionError(null);

    const res = await cancelInvoiceAction(invoiceId, projectId);
    if (res.error) {
      setActionError(res.error);
    } else {
      router.refresh();
    }
    setIsSubmitting(false);
  }

  async function handleRecordReceipt(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setActionError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("projectId", projectId);

    const res = await createReceiptAction(formData);
    if (res.error) {
      setActionError(res.error);
    } else {
      setIsRecordReceiptModalOpen(false);
      router.refresh();
    }
    setIsSubmitting(false);
  }

  async function handleAttachInvoiceDoc(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!targetInvoiceIdForDoc) return;
    setIsSubmitting(true);
    setActionError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("project_id", projectId);
    formData.set("category", "invoice");
    formData.set("invoice_id", targetInvoiceIdForDoc);

    const res = await uploadDocumentAction(null, formData);
    if (res.error) {
      setActionError(res.error);
    } else {
      setIsAttachDocModalOpen(false);
      setTargetInvoiceIdForDoc(null);
      router.refresh();
    }
    setIsSubmitting(false);
  }

  async function handleDownloadDoc(docId: string) {
    const res = await getSignedDocumentUrlAction(docId);
    if (res.downloadUrl) {
      window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
    } else if (res.error) {
      alert(res.error);
    }
  }

  return (
    <div className="space-y-8">
      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECTION 1: CONTRACT VALUE & VARIATIONS (RULE F1) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-amber-400" />
              <span>1. Contract Value &amp; Variation Orders</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Base contract value (Director only) plus approved variation orders (ex-GST) for {projectCode} ({projectName}).
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isDirector && (
              <>
                <button
                  onClick={() => setIsContractValueModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                >
                  <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Edit Base Value</span>
                </button>

                <button
                  onClick={() => setIsAddVariationModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-600/25"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Variation Order</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Commercial Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="text-[11px] font-medium text-slate-400">Base Contract Value (Ex-GST)</div>
            <div className="text-2xl font-bold font-mono text-slate-100 mt-2">
              {billingData.commercials
                ? formatPaise(Math.round(billingData.commercials.contract_value_excl_gst * 100))
                : "₹0.00"}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Confirmed client order</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="text-[11px] font-medium text-slate-400">Approved Variations</div>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-2">
              {formatPaise(
                billingData.revisedContractValuePaise -
                  Math.round((billingData.commercials?.contract_value_excl_gst || 0) * 100)
              )}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              {billingData.variations.filter((v) => v.status === "approved").length} approved variations
            </div>
          </div>

          <div className="p-4 rounded-xl border border-emerald-800/40 bg-emerald-950/20">
            <div className="text-[11px] font-medium text-emerald-400">Revised Contract Value</div>
            <div className="text-2xl font-bold font-mono text-emerald-300 mt-2">
              {formatPaise(billingData.revisedContractValuePaise)}
            </div>
            <div className="text-[10px] text-emerald-500/80 mt-1">Governing billing limit (Ex-GST)</div>
          </div>
        </div>

        {/* Variations List Table */}
        {billingData.variations.length > 0 && (
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Variation Title</th>
                  <th className="py-2.5 px-4 text-right">Amount (Ex-GST)</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4">Approved On</th>
                  <th className="py-2.5 px-4">Notes</th>
                  {isDirector && <th className="py-2.5 px-4 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {billingData.variations.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 font-semibold text-slate-200">{v.title}</td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono font-bold ${
                        v.amount_excl_gst < 0 ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      {formatPaise(Math.round(v.amount_excl_gst * 100))}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                          v.status === "approved"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : v.status === "rejected"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {v.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 font-mono">
                      {v.approved_on || "-"}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400">{v.note || "-"}</td>
                    {isDirector && (
                      <td className="py-2.5 px-4 text-right">
                        {v.status === "proposed" && (
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleUpdateVariationStatus(v.id, "approved")}
                              className="px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px]"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleUpdateVariationStatus(v.id, "rejected")}
                              className="px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px]"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 2: PAYMENT MILESTONES (RULE F5) */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>2. Billing Schedule / Payment Milestones</span>
            </h3>
          </div>

          <button
            onClick={() => setIsAddMilestoneModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-600/25"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Milestone</span>
          </button>
        </div>

        {/* Rule F5 Completeness Banner */}
        {!billingData.isCompletenessMatch && (
          <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/80 text-amber-300 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="flex-1 font-medium">
              {billingData.completenessMessage || "Billing schedule does not match contract value."}
            </div>
          </div>
        )}

        {billingData.isCompletenessMatch && (
          <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Billing schedule matches revised contract value (₹{formatPaise(billingData.revisedContractValuePaise)}).</span>
          </div>
        )}

        {/* Milestones Table */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
              <tr>
                <th className="py-2.5 px-4 w-12 text-center">#</th>
                <th className="py-2.5 px-4">Milestone Label</th>
                <th className="py-2.5 px-4">Expected Date</th>
                <th className="py-2.5 px-4 text-right">Amount (Ex-GST)</th>
                <th className="py-2.5 px-4 text-center">Invoice Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {billingData.milestones.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No payment milestones entered yet. Add milestones to establish billing schedule.
                  </td>
                </tr>
              ) : (
                billingData.milestones.map((m) => {
                  const linkedInv = billingData.invoices.find(
                    (inv) => inv.payment_milestone_id === m.id && !inv.is_cancelled
                  );

                  return (
                    <tr key={m.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-4 text-center font-mono text-slate-500">
                        {m.position}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-200">{m.label}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-300">{m.expected_date}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-100">
                        {formatPaise(Math.round(m.amount_excl_gst * 100))}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {linkedInv ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Invoiced ({linkedInv.invoice_number})
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            Pending Invoice
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteMilestone(m.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition"
                          title="Delete Milestone"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: INVOICES (RULE F2) */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>3. Invoices</span>
            </h3>
          </div>

          <button
            onClick={() => setIsCreateInvoiceModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-600/25"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Raise Invoice</span>
          </button>
        </div>

        {/* Invoice List Table */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Invoice #</th>
                <th className="py-2.5 px-4">Dates (Inv / Due)</th>
                <th className="py-2.5 px-4 text-right">Ex-GST</th>
                <th className="py-2.5 px-4 text-right">GST</th>
                <th className="py-2.5 px-4 text-right">Total (Incl GST)</th>
                <th className="py-2.5 px-4 text-right">Settled</th>
                <th className="py-2.5 px-4 text-right">Outstanding</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-center">Docs</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {billingData.invoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    No invoices raised for this project yet.
                  </td>
                </tr>
              ) : (
                billingData.invoices.map((inv) => {
                  const exGst = Math.round(inv.amount_excl_gst * 100);
                  const gst = Math.round(inv.gst_amount * 100);
                  const total = exGst + gst;

                  // Settled
                  const linkedReceipts = billingData.receipts.filter(
                    (r) => r.invoice_id === inv.id
                  );
                  const settledPaise = linkedReceipts.reduce(
                    (sum, r) =>
                      sum +
                      Math.round(r.amount_received * 100) +
                      Math.round((r.tds_amount || 0) * 100),
                    0
                  );
                  const outstandingPaise = inv.is_cancelled
                    ? 0
                    : Math.max(0, total - settledPaise);

                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-slate-800/30 ${
                        inv.is_cancelled ? "opacity-50 line-through" : ""
                      }`}
                    >
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-200">
                        {inv.invoice_number}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">
                        <div>{inv.invoice_date}</div>
                        <div className="text-slate-500">Due: {inv.due_date}</div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-300">
                        {formatPaise(exGst)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-400">
                        {formatPaise(gst)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-100">
                        {formatPaise(total)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-emerald-400">
                        {formatPaise(settledPaise)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-400">
                        {formatPaise(outstandingPaise)}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {inv.is_cancelled ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            CANCELLED
                          </span>
                        ) : outstandingPaise === 0 ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            PAID
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            OPEN
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          {(inv.documents || []).map((doc) => (
                            <button
                              key={doc.id}
                              onClick={() => handleDownloadDoc(doc.id)}
                              className="p-1 text-slate-400 hover:text-amber-400 transition"
                              title={`Download ${doc.title}`}
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                            </button>
                          ))}
                          <button
                            onClick={() => {
                              setTargetInvoiceIdForDoc(inv.id);
                              setIsAttachDocModalOpen(true);
                            }}
                            className="p-1 text-slate-500 hover:text-emerald-400 transition"
                            title="Attach Document"
                          >
                            <Upload className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {!inv.is_cancelled && (
                          <button
                            onClick={() => handleCancelInvoice(inv.id, inv.invoice_number)}
                            className="text-slate-500 hover:text-rose-400 transition p-1"
                            title="Cancel Invoice"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 4: RECEIPTS & ADVANCES (RULES F2, F3) */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-400" />
              <span>4. Receipts &amp; Customer Advances</span>
            </h3>
          </div>

          <button
            onClick={() => setIsRecordReceiptModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-600/25"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Receipt</span>
          </button>
        </div>

        {/* Receipts Table */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Receipt Date</th>
                <th className="py-2.5 px-4">Invoice # / Status</th>
                <th className="py-2.5 px-4 text-right">Amount Received</th>
                <th className="py-2.5 px-4 text-right">TDS</th>
                <th className="py-2.5 px-4 text-right">Total Settled</th>
                <th className="py-2.5 px-4">Mode</th>
                <th className="py-2.5 px-4">Reference</th>
                <th className="py-2.5 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {billingData.receipts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No receipts recorded yet for this project.
                  </td>
                </tr>
              ) : (
                billingData.receipts.map((rec) => {
                  const recPaise = Math.round(rec.amount_received * 100);
                  const tdsPaise = Math.round((rec.tds_amount || 0) * 100);
                  const totalPaise = recPaise + tdsPaise;

                  return (
                    <tr key={rec.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-4 font-mono text-slate-300">{rec.receipt_date}</td>
                      <td className="py-2.5 px-4 font-mono">
                        {rec.invoice ? (
                          <span className="text-slate-200 font-medium">
                            {rec.invoice.invoice_number}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                            Advance
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-400">
                        {formatPaise(recPaise)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-400">
                        {formatPaise(tdsPaise)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-100">
                        {formatPaise(totalPaise)}
                      </td>
                      <td className="py-2.5 px-4 font-mono uppercase text-slate-400">
                        {rec.mode.replace("_", " ")}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-400">
                        {rec.reference || "-"}
                      </td>
                      <td className="py-2.5 px-4 text-slate-400">{rec.note || "-"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: EDIT CONTRACT VALUE */}
      {isContractValueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-slate-100">Edit Base Contract Value</h3>
            <form onSubmit={handleUpdateContractValue} className="space-y-4">
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Contract Value Ex-GST (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={contractValueInput}
                  onChange={(e) => setContractValueInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsContractValueModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  Save Value
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD VARIATION */}
      {isAddVariationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-slate-100">Add Variation Order</h3>
            <form onSubmit={handleCreateVariation} className="space-y-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g. Additional Canopy Extension"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Amount Ex-GST (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="amountExclGst"
                    required
                    placeholder="e.g. 150000 or -25000"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500">Negative for deduction</span>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue="approved"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="approved">Approved</option>
                    <option value="proposed">Proposed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Notes</label>
                <textarea
                  name="note"
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddVariationModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  Add Variation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD MILESTONE */}
      {isAddMilestoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-slate-100">Add Payment Milestone</h3>
            <form onSubmit={handleCreateMilestone} className="space-y-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Milestone Label</label>
                <input
                  type="text"
                  name="label"
                  required
                  placeholder="e.g. Advance 20% on Confirmation"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Amount Ex-GST (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="amountExclGst"
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Expected Date</label>
                  <input
                    type="date"
                    name="expectedDate"
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Sequence Position</label>
                <input
                  type="number"
                  name="position"
                  defaultValue={billingData.milestones.length + 1}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddMilestoneModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  Create Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RAISE INVOICE */}
      {isCreateInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-slate-100">Raise Customer Invoice</h3>
            <form onSubmit={handleCreateInvoice} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Invoice Number <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="invoiceNumber"
                    required
                    placeholder="e.g. WB-INV-2026-001"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Linked Milestone (Optional)
                  </label>
                  <select
                    name="paymentMilestoneId"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">None (Custom Invoice)</option>
                    {billingData.milestones.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} (₹{m.amount_excl_gst})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    name="invoiceDate"
                    required
                    defaultValue={defaultDates.today}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    name="dueDate"
                    required
                    defaultValue={defaultDates.due}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Amount Ex-GST (₹) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="amountExclGst"
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">GST Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="gstAmount"
                    defaultValue="0"
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Notes</label>
                <textarea
                  name="note"
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateInvoiceModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  Raise Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD RECEIPT */}
      {isRecordReceiptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-slate-100">Record Customer Receipt</h3>
            <form onSubmit={handleRecordReceipt} className="space-y-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Invoice (Optional)
                </label>
                <select
                  name="invoiceId"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">Advance Received (Unallocated)</option>
                  {billingData.invoices
                    .filter((inv) => !inv.is_cancelled)
                    .map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} (Due: {inv.due_date})
                      </option>
                    ))}
                </select>
                <span className="text-[10px] text-slate-500">
                  Leave unselected to record as advance received.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Receipt Date</label>
                  <input
                    type="date"
                    name="receiptDate"
                    required
                    defaultValue={defaultDates.today}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Amount Received (₹) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="amountReceived"
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">TDS Deducted (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="tdsAmount"
                    defaultValue="0"
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Payment Mode</label>
                  <select
                    name="mode"
                    defaultValue="bank_transfer"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="cheque">Cheque</option>
                    <option value="upi">UPI</option>
                    <option value="cash">Cash</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Reference / UTR #</label>
                  <input
                    type="text"
                    name="reference"
                    placeholder="Bank reference or cheque #"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Notes</label>
                <textarea
                  name="note"
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRecordReceiptModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  Record Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ATTACH INVOICE DOCUMENT */}
      {isAttachDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-slate-100">Attach Document to Invoice</h3>
            <form onSubmit={handleAttachInvoiceDoc} className="space-y-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Document Title</label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g. Signed Tax Invoice PDF"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">File</label>
                <input
                  type="file"
                  name="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:bg-slate-800 file:text-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAttachDocModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  Upload &amp; Attach
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
