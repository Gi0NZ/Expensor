import { PublicClientApplication } from "@azure/msal-browser";


export const msalConfig = {
  auth: {
    clientId: process.env.REACT_APP_CLIENT_ID,
    authority: process.env.REACT_APP_API_AUTHORITY,
    redirectUri: "http://localhost:3000"
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: true
  }
};

export const loginRequest = {
  scopes: [
    "openid",
    "profile",
    "email",
    `${process.env.REACT_APP_AUDIENCE}/access_as_user`
  ]
};

export const tokenRequest = {
    scopes: [`${process.env.REACT_APP_AUDIENCE}/access_as_user`]
};

export const msalInstance = new PublicClientApplication(msalConfig);
