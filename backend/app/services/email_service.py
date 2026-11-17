"""
BugBash - Real-Time Email Delivery Service
Handles SMTP email dispatch for OTP email verification and password reset links.
Supports Gmail SMTP, SendGrid, Amazon SES, or custom SMTP servers.
Gracefully falls back to development logging if SMTP credentials are not configured.
"""

import os
import smtplib
import logging
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Tuple, Optional

logger = logging.getLogger("bugbash.email")


class EmailService:
    def __init__(self):
        # Load environment configuration
        self.smtp_host = os.environ.get("SMTP_HOST", "").strip()
        self.smtp_port = int(os.environ.get("SMTP_PORT", "587"))
        self.smtp_user = os.environ.get("SMTP_USER", "").strip()
        self.smtp_password = os.environ.get("SMTP_PASSWORD", "").strip()
        self.from_email = os.environ.get("SMTP_FROM_EMAIL", self.smtp_user or "no-reply@bugbash.com").strip()
        self.from_name = os.environ.get("SMTP_FROM_NAME", "BugBash Security").strip()
        self.use_tls = os.environ.get("SMTP_USE_TLS", "true").lower() in ("true", "1", "yes")

    @property
    def is_configured(self) -> bool:
        """Returns True if minimum SMTP credentials are present."""
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)

    def _send_smtp_message(self, to_email: str, subject: str, html_body: str, plain_body: str) -> Tuple[bool, str]:
        """Synchronous internal worker that connects to the SMTP server and sends email."""
        if not self.is_configured:
            logger.info(
                f"[DEV MODE - SMTP NOT CONFIGURED] Would send email to {to_email} with subject '{subject}'. "
                f"To send real emails, set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD."
            )
            return False, "SMTP is not configured in environment. Local dev mode active."

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self.from_name} <{self.from_email}>"
            msg["To"] = to_email

            # Attach plain text and HTML versions
            msg.attach(MIMEText(plain_body, "plain", "utf-8"))
            msg.attach(MIMEText(html_body, "html", "utf-8"))

            if self.smtp_port == 465:
                # SSL connection
                with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, timeout=10) as server:
                    server.login(self.smtp_user, self.smtp_password)
                    server.sendmail(self.from_email, [to_email], msg.as_string())
            else:
                # TLS connection (Default for port 587)
                with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=10) as server:
                    if self.use_tls:
                        server.starttls()
                    server.login(self.smtp_user, self.smtp_password)
                    server.sendmail(self.from_email, [to_email], msg.as_string())

            logger.info(f"Email successfully delivered to {to_email} via {self.smtp_host}:{self.smtp_port}")
            return True, "Email sent successfully."

        except smtplib.SMTPAuthenticationError as e:
            err = f"SMTP Authentication failed for user {self.smtp_user}. Check App Password."
            logger.error(f"[BugBash Email Error] {err}: {e}")
            return False, err
        except Exception as e:
            err = f"Failed to deliver email to {to_email}: {str(e)}"
            logger.error(f"[BugBash Email Error] {err}")
            return False, err

    async def send_otp_email(
        self,
        to_email: str,
        otp_code: str,
        candidate_name: str = "Candidate"
    ) -> Tuple[bool, str]:
        """
        Sends an automated 6-digit OTP verification email with BugBash styling.
        Runs asynchronously to prevent blocking FastAPI worker threads.
        """
        subject = f"{otp_code} is your BugBash verification code"

        plain_body = f"""Hello {candidate_name},

Your BugBash verification code is: {otp_code}

This 6-digit code will expire in 10 minutes.
Enter this code in your browser to verify your email and activate your account.

If you did not request this verification, your account remains secure; no action is required.

Best regards,
The BugBash Team
https://bugbash.io
"""

        html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your BugBash Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0d13; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0d13; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #141721; border: 1px solid #232736; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.6);">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding: 32px 36px 20px; text-align: center; border-bottom: 1px solid #1f2330;">
              <span style="display: inline-block; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                Bug<span style="color: #ff6b35;">Bash</span>
              </span>
              <span style="display: inline-block; background-color: rgba(255,107,53,0.15); color: #ff6b35; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px; margin-left: 6px; vertical-align: middle;">AI</span>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 36px;">
              <h1 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 12px; text-align: center;">Verify Your Email Address</h1>
              <p style="font-size: 14.5px; color: #9ca3af; line-height: 1.6; margin: 0 0 24px; text-align: center;">
                Hello <strong style="color: #ffffff;">{candidate_name}</strong>, enter the code below to complete your registration and activate your BugBash assessment account.
              </p>

              <!-- OTP Code Display Card -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background: linear-gradient(135deg, rgba(255,107,53,0.12) 0%, rgba(255,140,66,0.06) 100%); border: 1px solid rgba(255,107,53,0.35); border-radius: 12px; padding: 18px 36px;">
                      <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #ff6b35;">
                        {otp_code}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Expiry Alert -->
              <p style="font-size: 13px; color: #9ca3af; text-align: center; margin: 0 0 24px;">
                ⏱ This code is valid for <strong>10 minutes</strong>. Never share this code with anyone.
              </p>

              <div style="background-color: #1a1e2b; border-left: 3px solid #ff6b35; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
                  <strong>Security Note:</strong> If you did not register for an account on BugBash, you can safely ignore this email. No account will be activated without this verification code.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 36px; background-color: #10121a; border-top: 1px solid #1c202d; text-align: center;">
              <p style="margin: 0; font-size: 11.5px; color: #6b7280; line-height: 1.5;">
                &copy; 2026 BugBash. Smart Coding. Better Assessment.<br>
                Automated algorithmic logic recognition and candidate evaluation platform.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

        return await asyncio.to_thread(self._send_smtp_message, to_email, subject, html_body, plain_body)

    async def send_password_reset_email(
        self,
        to_email: str,
        reset_url: str,
        user_name: str = "Candidate"
    ) -> Tuple[bool, str]:
        """
        Sends an automated Password Reset email with BugBash styling.
        Runs asynchronously to prevent blocking FastAPI worker threads.
        """
        subject = "Reset Your BugBash Password"

        plain_body = f"""Hello {user_name},

We received a request to reset your BugBash account password.
Please click the link below or paste it into your browser to establish a new password:

{reset_url}

This link is valid for 15 minutes and can only be used once.
If you did not request a password reset, you can safely ignore this email.

Best regards,
The BugBash Security Team
"""

        html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset Your BugBash Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0d13; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0d13; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #141721; border: 1px solid #232736; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.6);">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding: 32px 36px 20px; text-align: center; border-bottom: 1px solid #1f2330;">
              <span style="display: inline-block; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                Bug<span style="color: #ff6b35;">Bash</span>
              </span>
              <span style="display: inline-block; background-color: rgba(255,107,53,0.15); color: #ff6b35; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px; margin-left: 6px; vertical-align: middle;">AI</span>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 36px;">
              <h1 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 12px; text-align: center;">Reset Your Password</h1>
              <p style="font-size: 14.5px; color: #9ca3af; line-height: 1.6; margin: 0 0 28px; text-align: center;">
                Hello <strong style="color: #ffffff;">{user_name}</strong>, we received a password recovery request for your account. Click the button below to establish a new password.
              </p>

              <!-- CTA Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="{reset_url}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #ff6b35 0%, #ff8c42 100%); color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 16px rgba(255,107,53,0.35);">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; color: #9ca3af; text-align: center; margin: 0 0 20px;">
                ⏱ This link expires in <strong>15 minutes</strong> and can only be used once.
              </p>

              <div style="background-color: #1a1e2b; padding: 14px 16px; border-radius: 8px; word-break: break-all;">
                <p style="margin: 0 0 6px; font-size: 11.5px; color: #9ca3af;">Or copy and paste this link into your browser:</p>
                <a href="{reset_url}" style="font-size: 12px; color: #ff6b35; text-decoration: underline;">{reset_url}</a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 36px; background-color: #10121a; border-top: 1px solid #1c202d; text-align: center;">
              <p style="margin: 0; font-size: 11.5px; color: #6b7280; line-height: 1.5;">
                &copy; 2026 BugBash. If you did not request this, no action is needed.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

        return await asyncio.to_thread(self._send_smtp_message, to_email, subject, html_body, plain_body)


# Global Singleton Instance
email_service = EmailService()
