import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { LogMethods } from 'src/shared/decorators/log-methods.decorator';
import { AppConfigService } from '../config/config.service';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

const FROM = 'CredWave <noreply@credwave.app>';

function template(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
        <tr><td style="padding-bottom:24px">
          <span style="font-size:18px;font-weight:800;letter-spacing:-0.5px;color:#1a1a1a">CredWave</span>
        </td></tr>
        <tr><td style="background:#ffffff;border-radius:16px;padding:40px;border:1px solid #e8e5e0">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.3px">${title}</h1>
          ${body}
        </td></tr>
        <tr><td style="padding-top:24px;text-align:center;font-size:12px;color:#999">
          CredWave · AI-powered Google review management<br>
          <a href="https://credwave.app" style="color:#999">credwave.app</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444">${text}</p>`;
}

function btn(text: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin:8px 0 24px;padding:12px 24px;background:#4f46e5;color:#fff;font-size:14px;font-weight:600;border-radius:10px;text-decoration:none">${text}</a>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #e8e5e0;margin:24px 0">`;
}

function detail(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;font-size:13px;color:#888;width:160px">${label}</td>
    <td style="padding:8px 0;font-size:13px;font-weight:600;color:#1a1a1a">${value}</td>
  </tr>`;
}

function detailTable(rows: string): string {
  return `<table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0 24px">${rows}</table>`;
}

@LogMethods()
@Injectable()
export class EmailService {
  private resend: Resend;
  protected readonly logger: PinoLogger;

  constructor(
    private readonly cfg: AppConfigService,
    @InjectPinoLogger(EmailService.name) logger: PinoLogger,
  ) {
    this.logger = logger;
    this.resend = new Resend(this.cfg.get('resendApiKey'));
  }

  private async send(to: string, subject: string, html: string) {
    const { error } = await this.resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
    });
    if (error)
      this.logger.error({ error, to, subject }, 'Failed to send email');
  }

  async sendWelcome(to: string, name: string) {
    await this.send(
      to,
      'Welcome to CredWave!',
      template(
        `Welcome, ${name}! 👋`,
        p(
          'Thanks for signing up. CredWave helps you stay on top of your Google reviews — generating AI-crafted replies in seconds so you never leave a customer unanswered.',
        ) +
          p("Connect your Google Business Profile and you're ready to go.") +
          btn('Go to dashboard', 'https://dashboard.credwave.app') +
          p('If you have any questions, just reply to this email.'),
      ),
    );
  }

  async sendSubscriptionStarted(
    to: string,
    name: string,
    planName: string,
    period: string,
    nextBillingDate: string,
  ) {
    await this.send(
      to,
      `You're on the ${planName} plan — let's get to work`,
      template(
        'Subscription confirmed',
        p(
          `Hi ${name}, your <strong>${planName}</strong> subscription is now active.`,
        ) +
          detailTable(
            detail('Plan', planName) +
              detail('Billing', period === 'year' ? 'Annual' : 'Monthly') +
              detail('Next billing', nextBillingDate),
          ) +
          btn('Go to dashboard', 'https://dashboard.credwave.app') +
          divider() +
          p(
            'You can manage your subscription, update your payment method, or cancel anytime from your billing page.',
          ),
      ),
    );
  }

  async sendSubscriptionRenewed(
    to: string,
    name: string,
    planName: string,
    amount: string,
    nextBillingDate: string,
  ) {
    await this.send(
      to,
      'Your CredWave subscription has been renewed',
      template(
        'Subscription renewed',
        p(
          `Hi ${name}, your <strong>${planName}</strong> plan has been renewed successfully.`,
        ) +
          detailTable(
            detail('Plan', planName) +
              detail('Amount charged', amount) +
              detail('Next billing', nextBillingDate),
          ) +
          btn('View invoice', 'https://dashboard.credwave.app/billing') +
          divider() +
          p(
            "If you have any questions about your invoice, reply to this email and we'll sort it out.",
          ),
      ),
    );
  }

  async sendSubscriptionCanceled(
    to: string,
    name: string,
    planName: string,
    accessUntil: string,
  ) {
    await this.send(
      to,
      'Your CredWave subscription has been canceled',
      template(
        'Subscription canceled',
        p(
          `Hi ${name}, your <strong>${planName}</strong> subscription has been canceled.`,
        ) +
          p(
            `You'll keep full access to CredWave until <strong>${accessUntil}</strong>. After that, your account will be downgraded.`,
          ) +
          detailTable(detail('Access until', accessUntil)) +
          btn('Reactivate', 'https://credwave.app/pricing') +
          divider() +
          p(
            'Changed your mind? You can reactivate at any time before your access expires.',
          ),
      ),
    );
  }

  async sendPaymentFailed(to: string, name: string, planName: string) {
    await this.send(
      to,
      'Payment failed — action required',
      template(
        'Payment failed',
        p(
          `Hi ${name}, we couldn't process your payment for the <strong>${planName}</strong> plan.`,
        ) +
          p(
            "Please update your payment method to keep your account active. If this isn't resolved soon, your subscription will be suspended.",
          ) +
          btn(
            'Update payment method',
            'https://dashboard.credwave.app/billing',
          ) +
          divider() +
          p(
            "If you think this is an error, reply to this email and we'll help you right away.",
          ),
      ),
    );
  }

  async sendPromoRedeemed(
    to: string,
    name: string,
    code: string,
    accessUntil: string,
  ) {
    await this.send(
      to,
      'Your promo code is active — enjoy CredWave',
      template(
        'Promo code redeemed',
        p(
          `Hi ${name}, your promo code <strong>${code}</strong> has been applied successfully.`,
        ) +
          detailTable(
            detail('Code', code) + detail('Access until', accessUntil),
          ) +
          btn('Go to dashboard', 'https://dashboard.credwave.app') +
          divider() +
          p(
            'Make the most of your access — connect your Google Business Profile and start managing reviews today.',
          ),
      ),
    );
  }

  async sendNewLogin(to: string, name: string, ip: string, time: string) {
    await this.send(
      to,
      'New sign-in to your CredWave account',
      template(
        'New sign-in detected',
        p(`Hi ${name}, we noticed a new sign-in to your CredWave account.`) +
          detailTable(detail('IP address', ip) + detail('Time', time)) +
          p('If this was you, no action is needed.') +
          divider() +
          p(
            'If you don\'t recognise this sign-in, please <a href="https://credwave.app/auth" style="color:#4f46e5">secure your account</a> immediately.',
          ),
      ),
    );
  }

  async sendReplyPosted(
    to: string,
    name: string,
    restaurantName: string,
    reviewerName: string,
  ) {
    await this.send(
      to,
      `Your reply at ${restaurantName} was posted on Google`,
      template(
        'Reply posted to Google',
        p(
          `Hi ${name}, your reply to a review from <strong>${reviewerName}</strong> at <strong>${restaurantName}</strong> has been successfully posted on Google Maps.`,
        ) + btn('View on CredWave', 'https://dashboard.credwave.app'),
      ),
    );
  }

  async sendAutoReply(
    to: string,
    name: string,
    restaurantName: string,
    reviewerName: string,
    rating: number,
  ) {
    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    await this.send(
      to,
      `CredWave auto-replied to a review at ${restaurantName}`,
      template(
        'Auto-reply posted',
        p(
          `Hi ${name}, CredWave automatically replied to a new review at <strong>${restaurantName}</strong>.`,
        ) +
          detailTable(
            detail('Reviewer', reviewerName) + detail('Rating', stars),
          ) +
          btn('View on CredWave', 'https://dashboard.credwave.app') +
          divider() +
          p('You can view or edit the reply from your CredWave dashboard.'),
      ),
    );
  }

  async sendNewReview(
    to: string,
    name: string,
    restaurantName: string,
    reviewerName: string,
    rating: number,
    reviewText: string | null,
  ) {
    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    const snippet = reviewText
      ? reviewText.length > 200
        ? reviewText.slice(0, 200) + '…'
        : reviewText
      : 'No written review.';

    await this.send(
      to,
      `New ${rating}-star review for ${restaurantName}`,
      template(
        'New review received',
        p(
          `Hi ${name}, <strong>${restaurantName}</strong> just received a new Google review.`,
        ) +
          `<div style="background:#f5f4f0;border-radius:10px;padding:16px 20px;margin:16px 0 24px">
          <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#1a1a1a">${reviewerName}</p>
          <p style="margin:0 0 8px;font-size:16px;color:#f59e0b;letter-spacing:2px">${stars}</p>
          <p style="margin:0;font-size:14px;color:#555;line-height:1.6;font-style:italic">"${snippet}"</p>
        </div>` +
          btn('Reply on CredWave', 'https://dashboard.credwave.app'),
      ),
    );
  }
}
