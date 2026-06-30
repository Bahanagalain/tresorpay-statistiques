// ─────────────────────────────────────────────────────────────────────
// TresorPay Statistiques — Service email
// SMTP via nodemailer, rapports quotidiens, verification email
// ─────────────────────────────────────────────────────────────────────

import nodemailer from 'nodemailer';
import prisma from '../config/prisma.js';

let transporter = null;

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION SMTP
// ═══════════════════════════════════════════════════════════════

function createTransporter() {
  const host = process.env.MAIL_HOST;
  const port = parseInt(process.env.MAIL_PORT) || 587;
  const user = process.env.MAIL_USERNAME;
  const pass = process.env.MAIL_PASSWORD;

  if (!host || !user || !pass) {
    console.warn('[EMAIL] Configuration SMTP incomplete (MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD requis)');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });
}

export async function verifySmtp() {
  transporter = createTransporter();
  if (!transporter) return false;
  try {
    await transporter.verify();
    console.log('[EMAIL] SMTP verifie avec succes');
    return true;
  } catch (err) {
    console.error('[EMAIL] SMTP verification echouee:', err.message);
    return false;
  }
}

function getFromAddress() {
  return process.env.MAIL_FROM || 'TresorPay Statistiques <noreply@tresorpay.cm>';
}

// ═══════════════════════════════════════════════════════════════
// VERIFICATION EMAIL
// ═══════════════════════════════════════════════════════════════

export async function sendVerificationEmail(email, code) {
  if (!transporter) {
    transporter = createTransporter();
  }
  if (!transporter) throw new Error('SMTP non configure');

  await transporter.sendMail({
    from: getFromAddress(),
    to: email,
    subject: 'Verification de votre email — TresorPay Statistiques',
    html: `
      <div style="font-family: Inter, -apple-system, sans-serif; max-width: 500px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #E2B93B, #9E7D17); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 20px;">TresorPay Statistiques</h1>
        </div>
        <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #374151; margin: 0 0 16px;">Votre code de verification :</p>
          <div style="background: #f9fafb; border: 2px dashed #d1d5db; border-radius: 8px; padding: 16px; text-align: center; margin: 0 0 16px;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111827;">${code}</span>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin: 0;">Ce code expire dans 15 minutes. Si vous n'avez pas demande cette verification, ignorez ce message.</p>
        </div>
      </div>
    `,
  });
}

// ═══════════════════════════════════════════════════════════════
// RAPPORT QUOTIDIEN
// ═══════════════════════════════════════════════════════════════

function buildReportHtml(kpi, user, options = {}) {
  const dateStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formatMontant = (val) => Number(val || 0).toLocaleString('fr-FR');
  const tauxPaiement = Number(kpi.tauxPaiement || 0).toFixed(1);
  const progression = Number(kpi.progressionMoisPrecedent || 0);
  const progressionSign = progression >= 0 ? '+' : '';
  const progressionColor = progression >= 0 ? '#059669' : '#dc2626';

  return `
    <div style="font-family: Inter, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #f3f4f6;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #E2B93B, #9E7D17); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">TresorPay Statistiques</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px;">
          Rapport ${options.isTest ? 'test ' : ''}du ${dateStr}
        </p>
      </div>

      <!-- Body -->
      <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="color: #374151; margin: 0 0 20px; font-size: 15px;">
          Bonjour <strong>${user.nomComplet || user.identifiant}</strong>,
        </p>
        <p style="color: #6b7280; margin: 0 0 20px; font-size: 14px;">
          Voici le resume de l'activite TresorPay.
        </p>

        <!-- KPI Cards -->
        <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">
          <tr>
            <td style="padding: 12px; background: #f0fdf4; border-radius: 8px; text-align: center; width: 50%;">
              <div style="color: #059669; font-size: 24px; font-weight: 700;">${formatMontant(kpi.totalRevenus)}</div>
              <div style="color: #6b7280; font-size: 12px; margin-top: 4px;">FCFA de revenus</div>
            </td>
            <td style="width: 12px;"></td>
            <td style="padding: 12px; background: #eff6ff; border-radius: 8px; text-align: center; width: 50%;">
              <div style="color: #2563eb; font-size: 24px; font-weight: 700;">${kpi.totalSoumissions || 0}</div>
              <div style="color: #6b7280; font-size: 12px; margin-top: 4px;">soumissions</div>
            </td>
          </tr>
        </table>

        <!-- Detail table -->
        <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px;">
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 8px; color: #374151; font-size: 14px;">Soumissions payees</td>
            <td style="padding: 10px 8px; text-align: right; font-weight: 600; color: #059669; font-size: 14px;">${kpi.soumissionsPayees || 0}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 8px; color: #374151; font-size: 14px;">Soumissions en attente</td>
            <td style="padding: 10px 8px; text-align: right; font-weight: 600; color: #d97706; font-size: 14px;">${kpi.soumissionsEnAttente || 0}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 8px; color: #374151; font-size: 14px;">Soumissions partielles</td>
            <td style="padding: 10px 8px; text-align: right; font-weight: 600; color: #7c3aed; font-size: 14px;">${kpi.soumissionsPartielles || 0}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 8px; color: #374151; font-size: 14px;">Soumissions echouees</td>
            <td style="padding: 10px 8px; text-align: right; font-weight: 600; color: #dc2626; font-size: 14px;">${kpi.soumissionsEchouees || 0}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 8px; color: #374151; font-size: 14px;">Taux de paiement</td>
            <td style="padding: 10px 8px; text-align: right; font-weight: 600; color: #111827; font-size: 14px;">${tauxPaiement}%</td>
          </tr>
          <tr>
            <td style="padding: 10px 8px; color: #374151; font-size: 14px;">Progression vs periode precedente</td>
            <td style="padding: 10px 8px; text-align: right; font-weight: 600; color: ${progressionColor}; font-size: 14px;">${progressionSign}${progression.toFixed(1)}%</td>
          </tr>
        </table>
      </div>

      <!-- Footer -->
      <div style="background: #f9fafb; padding: 16px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
          Ce rapport est genere automatiquement par TresorPay Statistiques.
          Pour modifier vos preferences, connectez-vous a votre tableau de bord.
        </p>
      </div>
    </div>
  `;
}

export async function sendDailyReport(user, options = {}) {
  if (!transporter) {
    transporter = createTransporter();
  }
  if (!transporter) {
    console.warn('[EMAIL] SMTP non configure, rapport non envoye');
    return;
  }
  if (!user.email) {
    console.warn(`[EMAIL] Utilisateur ${user.identifiant} sans email, rapport ignore`);
    return;
  }

  // Calculer les KPI
  const { computeKpi } = await import('./computation.service.js');
  const kpi = await computeKpi();

  const dateStr = new Date().toLocaleDateString('fr-FR');
  const html = buildReportHtml(kpi, user, options);

  await transporter.sendMail({
    from: getFromAddress(),
    to: user.email,
    subject: `Rapport ${options.isTest ? 'test ' : ''}TresorPay Statistiques — ${dateStr}`,
    html,
  });
}

// ═══════════════════════════════════════════════════════════════
// ENVOI AUTOMATIQUE (appele par cron)
// ═══════════════════════════════════════════════════════════════

export async function checkAndSendDailyReports() {
  if (!transporter) {
    transporter = createTransporter();
  }
  if (!transporter) {
    console.warn('[EMAIL] SMTP non configure, rapports quotidiens non envoyes');
    return { envoyes: 0, erreurs: 0 };
  }

  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const users = await prisma.utilisateur.findMany({
    where: {
      rapportQuotidien: true,
      emailVerifie: true,
      estActif: true,
      heureRapport: hhmm,
      email: { not: null },
    },
  });

  if (users.length === 0) return { envoyes: 0, erreurs: 0 };

  console.log(`[EMAIL] ${users.length} rapport(s) a envoyer pour ${hhmm}`);

  let envoyes = 0;
  let erreurs = 0;

  for (const user of users) {
    try {
      await sendDailyReport(user);
      envoyes++;
      console.log(`[EMAIL] Rapport envoye a ${user.email}`);
    } catch (err) {
      erreurs++;
      console.error(`[EMAIL] Erreur envoi a ${user.email}:`, err.message);
    }
  }

  console.log(`[EMAIL] Rapports termines: ${envoyes} envoye(s), ${erreurs} erreur(s)`);
  return { envoyes, erreurs };
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION ALERTE (optionnel)
// ═══════════════════════════════════════════════════════════════

export async function sendAlertNotification(user, alertes) {
  if (!transporter) {
    transporter = createTransporter();
  }
  if (!transporter || !user.email) return;
  if (!alertes || alertes.length === 0) return;

  const alerteRows = alertes
    .map((a) => {
      const typeColor = a.type === 'danger' ? '#dc2626' : a.type === 'attention' ? '#d97706' : '#2563eb';
      const typeBg = a.type === 'danger' ? '#fef2f2' : a.type === 'attention' ? '#fffbeb' : '#eff6ff';
      return `
        <tr>
          <td style="padding: 10px 8px; border-bottom: 1px solid #f3f4f6;">
            <span style="display: inline-block; background: ${typeBg}; color: ${typeColor}; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">${a.type}</span>
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #f3f4f6; color: #374151; font-size: 14px;">
            <strong>${a.titre}</strong><br>
            <span style="color: #6b7280; font-size: 13px;">${a.description}</span>
          </td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <div style="font-family: Inter, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #dc2626, #991b1b); padding: 20px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Alertes TresorPay Statistiques</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px;">${alertes.length} alerte(s) detectee(s)</p>
      </div>
      <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; margin: 0 0 16px;">Bonjour <strong>${user.nomComplet || user.identifiant}</strong>,</p>
        <table style="width: 100%; border-collapse: collapse;">
          ${alerteRows}
        </table>
        <p style="color: #9ca3af; font-size: 12px; margin: 16px 0 0;">Connectez-vous a TresorPay Statistiques pour plus de details.</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: getFromAddress(),
    to: user.email,
    subject: `[Alerte] TresorPay Statistiques — ${alertes.length} alerte(s)`,
    html,
  });
}

// ═══════════════════════════════════════════════════════════════
// EMAIL GENERIQUE
// ═══════════════════════════════════════════════════════════════

export async function sendEmail(to, subject, html) {
  if (!transporter) {
    transporter = createTransporter();
  }
  if (!transporter) throw new Error('SMTP non configure');

  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    html,
  });
}
