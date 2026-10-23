import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteProps {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteProps) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. Verify user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized: Please sign in to access documents" },
      { status: 401 }
    );
  }

  // 2. Query document with current user credentials (enforces RLS and Rule R8)
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("id, title, storage_path, category")
    .eq("id", id)
    .single();

  if (docError || !doc) {
    return NextResponse.json(
      {
        error:
          "Access denied: You do not have permission to access this restricted document.",
      },
      { status: 403 }
    );
  }

  // 3. Document access allowed: generate private 60s signed URL
  const adminSupabase = createAdminClient();
  const { data: signedData, error: signError } = await adminSupabase.storage
    .from("project-files")
    .createSignedUrl(doc.storage_path, 60);

  if (signError || !signedData?.signedUrl) {
    return NextResponse.json(
      { error: "Failed to generate signed download link" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(signedData.signedUrl);
}
