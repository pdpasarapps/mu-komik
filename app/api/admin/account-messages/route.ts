import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const usersPerPage = 1000;
const maxUserPages = 100;

type AdminMessageBody =
  | { action: "reply"; contactMessageId: string; body: string }
  | { action: "system"; recipientEmail: string; subject: string; body: string };

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return errorResponse("Cross-site requests are not allowed.", 403);
  }
  try {
    if (new URL(origin).host !== request.headers.get("host")) {
      return errorResponse("Cross-origin requests are not allowed.", 403);
    }
  } catch {
    return errorResponse("Invalid request origin.", 403);
  }

  const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return errorResponse("Unauthorized.", 401);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Account messaging is unavailable because Supabase server credentials are missing.");
    return errorResponse("Account messaging is temporarily unavailable.", 503);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken);
  if (userError || !userData.user) return errorResponse("Unauthorized.", 401);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: sender, error: senderError } = await serviceClient
    .from("profiles")
    .select("role, is_staff, staff_permissions, staff_contact_categories")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (senderError) {
    console.error("Unable to verify account messaging permission:", senderError);
    return errorResponse("Could not verify messaging permission.", 500);
  }
  const isAdmin = sender?.role === "admin";
  const senderHasContactAccess = sender?.is_staff === true
    && Array.isArray(sender.staff_permissions)
    && sender.staff_permissions.includes("contact-messages");
  if (!isAdmin && !senderHasContactAccess) {
    return errorResponse("Contact message access is required.", 403);
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > 8 * 1024) return errorResponse("Request body is too large.", 413);
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return errorResponse("Invalid JSON request body.", 400);
  }
  if (!parsedBody || typeof parsedBody !== "object") return errorResponse("Invalid message request.", 400);

  const body = parsedBody as Partial<AdminMessageBody>;
  if (typeof body.body !== "string" || body.body.trim().length < 1 || body.body.trim().length > 5000) {
    return errorResponse("Message body must be between 1 and 5000 characters.", 400);
  }

  if (body.action === "reply") {
    if (typeof body.contactMessageId !== "string" || !uuidPattern.test(body.contactMessageId)) {
      return errorResponse("A valid contact message is required.", 400);
    }
    const { data: contactMessage, error: contactError } = await serviceClient
      .from("contact_messages")
      .select("id, user_id, email, subject, category")
      .eq("id", body.contactMessageId)
      .maybeSingle();
    if (contactError) {
      console.error("Unable to load contact message for reply:", contactError);
      return errorResponse("Contact message could not be loaded.", 500);
    }
    if (!contactMessage) return errorResponse("Contact message not found.", 404);
    if (!isAdmin && (!Array.isArray(sender.staff_contact_categories)
      || !sender.staff_contact_categories.includes(contactMessage.category))) {
      return errorResponse("Access to this contact message category is required.", 403);
    }
    let recipientId: string | null = contactMessage.user_id;
    if (!recipientId) {
      const contactEmail = contactMessage.email.toLowerCase();
      for (let page = 1; page <= maxUserPages; page += 1) {
        const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage: usersPerPage });
        if (error) {
          console.error("Unable to find account for contact message reply:", error);
          return errorResponse("The sender's account could not be verified.", 500);
        }
        const recipient = data.users.find((user) => user.email?.toLowerCase() === contactEmail);
        if (recipient) {
          recipientId = recipient.id;
          break;
        }
        if (data.users.length < usersPerPage) break;
      }
    }
    if (!recipientId) return errorResponse("No account was found for the sender's email address.", 404);

    const { error: insertError } = await serviceClient.from("account_messages").insert({
      recipient_id: recipientId,
      message_type: "private",
      contact_message_id: contactMessage.id,
      subject: `Balasan: ${contactMessage.subject}`.slice(0, 160),
      body: body.body.trim(),
    });
    if (insertError) {
      console.error("Unable to store private account message:", insertError);
      return errorResponse("Reply could not be sent.", 500);
    }
    const { error: updateError } = await serviceClient
      .from("contact_messages")
      .update({ status: "in_progress", updated_at: new Date().toISOString() })
      .eq("id", contactMessage.id);
    if (updateError) console.error("Unable to update contact status after sending reply:", updateError);
    return NextResponse.json({ success: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  }

  if (body.action !== "system"
    || typeof body.recipientEmail !== "string"
    || typeof body.subject !== "string") {
    return errorResponse("Invalid system message details.", 400);
  }
  const recipientEmail = body.recipientEmail.trim().toLowerCase();
  const subject = body.subject.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)
    || recipientEmail.length > 254
    || subject.length < 1 || subject.length > 160) {
    return errorResponse("Enter a valid recipient email and a subject of up to 160 characters.", 400);
  }

  let recipientId: string | null = null;
  for (let page = 1; page <= maxUserPages; page += 1) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage: usersPerPage });
    if (error) {
      console.error("Unable to find recipient account for system message:", error);
      return errorResponse("Recipient account could not be verified.", 500);
    }
    const recipient = data.users.find((user) => user.email?.toLowerCase() === recipientEmail);
    if (recipient) {
      recipientId = recipient.id;
      break;
    }
    if (data.users.length < usersPerPage) break;
  }
  if (!recipientId) return errorResponse("No account was found for that email address.", 404);

  const { error: insertError } = await serviceClient.from("account_messages").insert({
    recipient_id: recipientId,
    message_type: "system",
    subject,
    body: body.body.trim(),
  });
  if (insertError) {
    console.error("Unable to store system account message:", insertError);
    return errorResponse("System message could not be sent.", 500);
  }
  return NextResponse.json({ success: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
