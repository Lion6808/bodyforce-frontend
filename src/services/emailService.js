// src/services/emailService.js
// Service d'envoi d'emails via le backend Express (Nodemailer + Gmail)

const API_URL =
  process.env.NODE_ENV === "production"
    ? "https://bodyforce.onrender.com"
    : "http://localhost:3001";

/**
 * Vérifie si le service email est configuré sur le serveur
 */
export async function getEmailStatus() {
  try {
    const response = await fetch(`${API_URL}/api/email/status`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: JSON.stringify({ role: "admin" }),
      },
    });

    if (!response.ok) {
      throw new Error("Erreur lors de la vérification du statut email");
    }

    return await response.json();
  } catch (error) {
    console.error("Erreur getEmailStatus:", error);
    throw error;
  }
}

/**
 * Envoie un email à une liste de destinataires
 * @param {Object} params - Paramètres de l'email
 * @param {Array} params.recipients - Liste des destinataires [{email, firstName, name}]
 * @param {string} params.subject - Sujet de l'email
 * @param {string} params.body - Contenu de l'email (texte simple, les \n seront convertis en <br>)
 * @param {string} [params.replyTo] - Adresse de réponse optionnelle
 */
export async function sendEmail({ recipients, subject, body, replyTo }) {
  try {
    const response = await fetch(`${API_URL}/api/email/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: JSON.stringify({ role: "admin" }),
      },
      body: JSON.stringify({
        recipients,
        subject,
        body,
        replyTo,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Erreur lors de l'envoi de l'email");
    }

    return data;
  } catch (error) {
    console.error("Erreur sendEmail:", error);
    throw error;
  }
}

/**
 * Envoie un email à tous les membres actifs
 * @param {Array} members - Liste complète des membres
 * @param {string} subject - Sujet
 * @param {string} body - Contenu
 */
export async function sendEmailToActiveMembers(members, subject, body) {
  const today = new Date();
  const activeMembers = members.filter((m) => {
    if (!m.email || !m.endDate) return false;
    return new Date(m.endDate) >= today;
  });

  const recipients = activeMembers.map((m) => ({
    email: m.email,
    firstName: m.firstName,
    name: m.name,
  }));

  return sendEmail({ recipients, subject, body });
}

/**
 * Envoie un email aux membres dont l'abonnement expire bientôt
 * @param {Array} members - Liste complète des membres
 * @param {number} daysBeforeExpiry - Nombre de jours avant expiration
 * @param {string} subject - Sujet
 * @param {string} body - Contenu
 */
export async function sendEmailToExpiringMembers(
  members,
  daysBeforeExpiry,
  subject,
  body
) {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + daysBeforeExpiry);

  const expiringMembers = members.filter((m) => {
    if (!m.email || !m.endDate) return false;
    const endDate = new Date(m.endDate);
    return endDate >= today && endDate <= futureDate;
  });

  const recipients = expiringMembers.map((m) => ({
    email: m.email,
    firstName: m.firstName,
    name: m.name,
  }));

  return sendEmail({ recipients, subject, body });
}
