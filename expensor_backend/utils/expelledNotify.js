const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);


const expelledNotify = async (user_mail, user_name, sender_mail, admin_mail, admin_name, group_name) => {
  try {
    const { data, error } = await resend.emails.send({
       from: `Expensor App <${sender_mail}>`,
            to: [user_email],
            subject: `‼️ Sei stato espulso dal gruppo: ${group_name} ‼️`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #4CAF50;">ATTENZIONE!</h2>
                    <p>Ciao <strong>${user_name}</strong>,</p>
                    <p>Questa mail automatica ti è stata inviata per avvisarti della tua espulsione dal gruppo <strong>"${group_name}"</strong> su Expensor.</p>
                    <p>La decisione della tua espulsione è a carico di ${admin_name} (${admin_mail})</p>
                    <br/>
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
    console.error("Eccezione invio email di espulsione gruppo:", err);
    return false;
  }
};

module.exports = { expelledNotify };