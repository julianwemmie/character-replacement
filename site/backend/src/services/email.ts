import { Resend } from "resend";
import { config } from "../config.js";

let resend: Resend | null = null;

function getClient(): Resend | null {
  if (!config.email.resendApiKey) return null;
  if (!resend) resend = new Resend(config.email.resendApiKey);
  return resend;
}

/** Track sent emails to avoid duplicates (jobId -> true). */
const sentEmails = new Set<string>();

export async function sendVideoReadyEmail(
  userEmail: string,
  userName: string,
  jobId: string,
  videoUrl: string,
): Promise<void> {
  const key = `done:${jobId}`;
  if (sentEmails.has(key)) return;
  sentEmails.add(key);

  const client = getClient();
  if (!client) {
    console.log(`[email] Skipping ready email for job ${jobId} (Resend not configured)`);
    return;
  }

  const videoPageUrl = `${config.auth.url}/videos/${jobId}`;

  await client.emails.send({
    from: config.email.from,
    to: userEmail,
    subject: "Your video is ready!",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hey ${userName || "there"},</h2>
        <p>Your character replacement video is ready to view.</p>
        <p><a href="${videoPageUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 6px;">View Your Video</a></p>
        <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">If the button doesn't work, copy and paste this link: ${videoPageUrl}</p>
      </div>
    `,
  });

  console.log(`[email] Sent ready email for job ${jobId} to ${userEmail}`);
}

export async function sendVideoFailedEmail(
  userEmail: string,
  userName: string,
  jobId: string,
  error: string,
): Promise<void> {
  const key = `failed:${jobId}`;
  if (sentEmails.has(key)) return;
  sentEmails.add(key);

  const client = getClient();
  if (!client) {
    console.log(`[email] Skipping failure email for job ${jobId} (Resend not configured)`);
    return;
  }

  const retryUrl = `${config.auth.url}/create`;

  await client.emails.send({
    from: config.email.from,
    to: userEmail,
    subject: "Video generation failed",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hey ${userName || "there"},</h2>
        <p>Unfortunately your video (job ${jobId}) could not be generated.</p>
        <p style="padding: 12px; background: #fef2f2; border-radius: 6px; color: #991b1b;"><strong>Error:</strong> ${error}</p>
        <p><a href="${retryUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 6px;">Try Again</a></p>
      </div>
    `,
  });

  console.log(`[email] Sent failure email for job ${jobId} to ${userEmail}`);
}
