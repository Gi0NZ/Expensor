const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

// Configurazione JWKS di Microsoft
const client = jwksClient({
    jwksUri: `https://login.microsoftonline.com/${process.env.TENANT_ID}/discovery/v2.0/keys`
});

function getKey(header, callback) {
    client.getSigningKey(header.kid, (err, key) => {
        if (err) return callback(err);
        const signingKey = key.publicKey || key.rsaPublicKey;
        callback(null, signingKey);
    });
}

const authenticateToken = (req, context) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        context.res = { status: 401, body: "Accesso negato: Nessun token fornito." };
        return false;
    }
    context.log("🌍 jwksUri usato:", `https://login.microsoftonline.com/${process.env.TENANT_ID}/discovery/v2.0/keys`);
    context.log("📥 audience atteso:", process.env.AUDIENCE);

    return new Promise((resolve) => {
        jwt.verify(token, getKey, {
            audience: process.env.AUDIENCE,  // deve corrispondere al tuo "aud"
            issuer: `https://login.microsoftonline.com/${process.env.TENANT_ID}/v2.0`,
            algorithms: ["RS256"]
        }, (err, decoded) => {
            if (err) {
                context.res = { status: 403, body: "Token non valido." };
                return resolve(false);
            }

            // ✅ Check scope
            if (!decoded.scp || !decoded.scp.includes("access_as_user")) {
                context.res = { status: 403, body: "Token non valido: scope mancante." };
                return resolve(false);
            }

            req.user = decoded;
            return resolve(true);
        });
    });
};

module.exports = { authenticateToken };
