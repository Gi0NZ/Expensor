const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendBudgetAlert = async (email, name, amount, limit) => {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.SENDER_EMAIL,
      to: [email],
      subject: "⚠️ Attenzione: Budget Mensile Superato!",
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #e74c3c;">Budget Alert</h2>
          <p>Ciao <strong>${name}</strong>,</p>
          <p>Ti informiamo che le tue spese hanno appena superato il limite mensile impostato.</p>
          
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Limite impostato:</strong> € ${Number(limit).toFixed(2)}</p>
            <p style="margin: 5px 0; color: #e74c3c;">💸 <strong>Speso finora:</strong> € ${Number(amount).toFixed(2)}</p>
          </div>

          <p>Tieni d'occhio le tue finanze per il resto del mese!</p>
          <hr>
          <p style="font-size: 12px; color: #888;">Questa è una notifica automatica di Expensor.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Errore Resend:", error);
      return false;
    }

    console.log(`Email inviata a ${email} (ID: ${data.id})`);
    return true;
  } catch (err) {
    console.error("Eccezione invio email di budget:", err);
    return false;
  }
};

module.exports = { sendBudgetAlert };
