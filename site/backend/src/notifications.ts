import { Resend } from "resend";
import { getTursoClient, isTursoConfigured } from "./db";

// ---------------------------------------------------------------------------
// Resend client (lazy-initialized)
// ---------------------------------------------------------------------------

let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (resend) return resend;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  resend = new Resend(apiKey);
  return resend;
}

const FROM_ADDRESS =
  process.env.EMAIL_FROM || "Character Replacement <noreply@characterreplacement.com>";

// ---------------------------------------------------------------------------
// Look up user email from the database via the job's user_id
// ---------------------------------------------------------------------------

async function getUserEmailForJob(jobId: string): Promise<string | null> {
  if (!isTursoConfigured()) return null;

  const client = getTursoClient()!;
  const result = await client.execute({
    sql: `SELECT u.email FROM users u
          JOIN jobs j ON j.user_id = u.id
          WHERE j.id = ?`,
    args: [jobId],
  });

  if (result.rows.length === 0) return null;
  return result.rows[0].email as string;
}

// ---------------------------------------------------------------------------
// Send "Your video is ready!" email
// ---------------------------------------------------------------------------

export async function sendJobCompleteEmail(
  jobId: string,
  videoUrl?: string
): Promise<void> {
  const client = getResendClient();
  if (!client) {
    console.log("[notifications] Resend not configured — skipping email");
    return;
  }

  let email: string | null = null;
  try {
    email = await getUserEmailForJob(jobId);
  } catch (err) {
    console.error(
      "[notifications] Failed to look up user email:",
      err instanceof Error ? err.message : err
    );
    return;
  }

  if (!email) {
    console.log(
      `[notifications] No user email found for job ${jobId} — skipping email`
    );
    return;
  }

  const viewUrl = videoUrl || "#";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #111;">Your video is ready!</h2>
  <p>Your character replacement video has finished processing.</p>
  <a href="${viewUrl}"
     style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: #fff;
            text-decoration: none; border-radius: 6px; font-weight: 600;">
    View Video
  </a>
  <p style="margin-top: 24px; font-size: 13px; color: #666;">
    If the button doesn't work, copy and paste this link into your browser:<br/>
    <a href="${viewUrl}">${viewUrl}</a>
  </p>
</body>
</html>`.trim();

  try {
    await client.emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject: "Your video is ready!",
      html,
    });
    console.log(
      `[notifications] Sent completion email to ${email} for job ${jobId}`
    );
  } catch (err) {
    // Log but don't throw — we never want email failures to break the webhook
    console.error(
      "[notifications] Failed to send email:",
      err instanceof Error ? err.message : err
    );
  }
}
