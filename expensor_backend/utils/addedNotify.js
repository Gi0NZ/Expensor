const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);


const addedNotify = async (user_mail, user_name, sender_mail, admin_mail, admin_name, group_name, group_link) => {
  try {
    const { data, error } = await resend.emails.send({
      from: `Expensor App <${sender_mail}>`,
          to: [user_mail],
          subject: `Sei stato aggiunto al gruppo: ${group_name} 🎉`,
          html: `
              <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                  <h2 style="color: #4CAF50;">Benvenuto nel gruppo!</h2>
                  <p>Ciao <strong>${user_name}</strong>,</p>
                  <p>Sei stato aggiunto con successo al gruppo di spesa <strong>"${group_name}"</strong> da ${admin_name} (${admin_mail}) su Expensor.</p>
                  <p>Accedi subito per vedere le spese e aggiungere la tua parte.</p>
                  <br/>
                  <a href="${group_link}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Vai al Gruppo</a>
                  <p style="font-size: 0.8rem; color: #999; margin-top: 30px;">Se pensi sia un errore, contatta l'amministratore del gruppo.</p>
              </div>
          `,
    });

    if (error) {
      console.error("Errore Resend:", error);
      return false;
    }

    console.log(`Email inviata a ${user_mail} (ID: ${data.id})`);
    return true;
  } catch (err) {
    console.error("Eccezione invio email di aggiunta gruppo:", err);
    return false;
  }
};

module.exports = { addedNotify };