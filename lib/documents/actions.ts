"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UploadDocumentSchema, ReviewDrawingSchema } from "./types";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

/**
 * Uploads a document or drawing revision.
 * Enforces file size limits, stores in private bucket 'project-files', and records in public.documents.
 */
export async function uploadDocumentAction(prevState: unknown, formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required" };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { error: "Please select a valid file to upload" };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { error: "File exceeds maximum allowed size of 25 MB" };
  }

  const rawData = {
    project_id: formData.get("project_id") || null,
    category: formData.get("category"),
    title: formData.get("title"),
    supersedes_id: formData.get("supersedes_id") || null,
    invoice_id: formData.get("invoice_id") || null,
    vendor_order_id: formData.get("vendor_order_id") || null,
    bill_id: formData.get("bill_id") || null,
  };

  const parsed = UploadDocumentSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  // 1. Resolve project code for path organization
  let projectCode = "general";
  if (parsed.data.project_id) {
    const { data: proj } = await supabase
      .from("projects")
      .select("code")
      .eq("id", parsed.data.project_id)
      .single();
    if (proj?.code) {
      projectCode = proj.code;
    }
  }

  // 2. Resolve version number if superseding an older revision
  let versionNo = 1;
  if (parsed.data.supersedes_id) {
    const { data: olderDoc } = await supabase
      .from("documents")
      .select("version_no")
      .eq("id", parsed.data.supersedes_id)
      .single();
    if (olderDoc) {
      versionNo = (olderDoc.version_no || 1) + 1;
    }
  }

  // 3. Upload file to private storage bucket 'project-files'
  const adminSupabase = createAdminClient();
  const fileBytes = await file.arrayBuffer();
  const buffer = Buffer.from(fileBytes);
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `projects/${projectCode}/${Date.now()}_v${versionNo}_${cleanFileName}`;

  const { error: uploadError } = await adminSupabase.storage
    .from("project-files")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return { error: uploadError.message || "Failed to upload file to storage" };
  }

  // 4. Insert record into public.documents
  // If drawing, default review_status is 'pending'
  const isDrawing = parsed.data.category === "drawing";
  const reviewStatus = isDrawing ? "pending" : null;

  const { data: newDoc, error: insertError } = await supabase
    .from("documents")
    .insert({
      project_id: parsed.data.project_id || null,
      category: parsed.data.category,
      title: parsed.data.title,
      storage_path: storagePath,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      version_no: versionNo,
      review_status: reviewStatus,
      supersedes_id: parsed.data.supersedes_id || null,
      invoice_id: parsed.data.invoice_id || null,
      vendor_order_id: parsed.data.vendor_order_id || null,
      bill_id: parsed.data.bill_id || null,
      uploaded_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !newDoc) {
    return { error: insertError?.message || "Failed to save document metadata" };
  }

  revalidatePath("/admin/documents");
  if (parsed.data.project_id) {
    revalidatePath(`/admin/projects/${parsed.data.project_id}`);
  }

  return { success: true, documentId: newDoc.id };
}

/**
 * Reviews a drawing (Approve or Reject).
 * Only allowed for Director or Project Manager assigned to the project.
 */
export async function reviewDrawingAction(
  documentId: string,
  reviewStatus: "approved" | "rejected",
  reviewNote?: string | null
) {
  const parsed = ReviewDrawingSchema.safeParse({
    document_id: documentId,
    review_status: reviewStatus,
    review_note: reviewNote,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid inputs" };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required" };
  }

  const { error } = await supabase
    .from("documents")
    .update({
      review_status: parsed.data.review_status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_note: parsed.data.review_note || null,
    })
    .eq("id", parsed.data.document_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/documents");
  return { success: true };
}

/**
 * Generates a temporary 60-second signed URL for download.
 * Validates document permissions via RLS before generating.
 */
export async function getSignedDocumentUrlAction(documentId: string) {
  const supabase = await createClient();

  // 1. Verify user can access document under RLS
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("id, title, storage_path, category")
    .eq("id", documentId)
    .single();

  if (docError || !doc) {
    return {
      error: "Access denied: You do not have permission to view or download this document.",
    };
  }

  // 2. Generate signed URL from private bucket
  const adminSupabase = createAdminClient();
  const { data: signedData, error: signError } = await adminSupabase.storage
    .from("project-files")
    .createSignedUrl(doc.storage_path, 60); // 60 seconds expiry

  if (signError || !signedData?.signedUrl) {
    return { error: signError?.message || "Failed to generate download link" };
  }

  return { success: true, downloadUrl: signedData.signedUrl, title: doc.title };
}
