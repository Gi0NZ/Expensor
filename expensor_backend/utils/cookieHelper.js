module.exports.parseCookies = (req) => {
    const list = {};
    const rc = req.headers.cookie;

    rc && rc.split(';').forEach((cookie) => {
        const parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });

    return list;
};